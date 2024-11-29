import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

// GET /api/users - Get all users
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const client = await clientPromise
    const db = client.db()
    const users = await db.collection('users').find({}).toArray()
    
    // Map MongoDB _id to id for frontend compatibility
    const mappedUsers = users.map(user => ({
      ...user,
      id: user._id.toString(),
      _id: undefined // Remove _id to avoid confusion
    }))
    
    return NextResponse.json(mappedUsers)
  } catch (error) {
    console.error('Error fetching users:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

// DELETE /api/users?userId=[id] - Delete a user
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ message: 'User ID is required' }, { status: 400 })
    }

    console.log('Attempting to delete user:', userId)

    const client = await clientPromise
    const db = client.db()
    const objectId = new ObjectId(userId)

    // First check if user exists
    const user = await db.collection('users').findOne({ _id: objectId })
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    console.log('Found user to delete:', user)

    try {
      // Delete user's sessions first
      const sessionResult = await db.collection('sessions').deleteMany({
        $or: [
          { userId: userId },
          { 'session.user.id': userId },
          { 'session.user.email': user.email }
        ]
      })
      console.log('Deleted sessions:', sessionResult)

      // Delete user's accounts
      const accountResult = await db.collection('accounts').deleteMany({
        userId: userId
      })
      console.log('Deleted accounts:', accountResult)

      // Finally delete the user
      const deleteResult = await db.collection('users').deleteOne({ _id: objectId })
      console.log('Delete user result:', deleteResult)

      if (deleteResult.deletedCount === 0) {
        return NextResponse.json({ 
          message: 'User not found or already deleted' 
        }, { status: 404 })
      }

      return NextResponse.json({ 
        message: 'User deleted successfully',
        userId: userId
      })

    } catch (error) {
      console.error('Error during deletion:', error)
      return NextResponse.json({ 
        message: 'Failed to delete user',
        error: error instanceof Error ? error.message : String(error)
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in DELETE handler:', error)
    return NextResponse.json({ 
      message: 'Failed to delete user',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// PATCH /api/users?userId=[id]&action=[approve|reject] - Update user status
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const action = searchParams.get('action')

    if (!userId || !action) {
      return NextResponse.json({ message: 'User ID and action are required' }, { status: 400 })
    }

    if (action !== 'approve') {
      return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()
    const objectId = new ObjectId(userId)

    // First check if user exists
    const user = await db.collection('users').findOne({ _id: objectId })
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    try {
      // Update user document
      const updateResult = await db.collection('users').findOneAndUpdate(
        { _id: objectId },
        { 
          $set: { 
            status: 'approved',
            updatedAt: new Date()
          }
        },
        { 
          returnDocument: 'after',
          includeResultMetadata: true 
        }
      )

      if (!updateResult || !updateResult.value) {
        console.error('Update failed:', { updateResult })
        return NextResponse.json(
          { message: 'Failed to update user - no document returned' }, 
          { status: 500 }
        )
      }

      const updatedDoc = updateResult.value

      try {
        // Update all sessions for this user
        await db.collection('sessions').updateMany(
          { 
            $or: [
              { userId: updatedDoc._id.toString() },
              { 'session.user.email': updatedDoc.email }
            ]
          },
          {
            $set: {
              'session.user.status': 'approved',
              'session.user.updatedAt': new Date()
            }
          }
        )

        // Update JWT sessions if they exist
        await db.collection('accounts').updateMany(
          { userId: updatedDoc._id.toString() },
          {
            $set: {
              'session.user.status': 'approved',
              'session.user.updatedAt': new Date()
            }
          }
        )

      } catch (sessionError) {
        console.error('Error updating sessions:', sessionError)
        // Continue since user update was successful
      }

      // Return updated user with proper ID mapping
      const responseUser = {
        ...updatedDoc,
        id: updatedDoc._id.toString(),
        _id: undefined
      }

      return NextResponse.json({ 
        message: 'User approved successfully',
        user: responseUser
      })

    } catch (error) {
      console.error('Error in user update:', error)
      return NextResponse.json({ 
        message: 'Failed to update user',
        error: error instanceof Error ? error.message : String(error)
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in PATCH handler:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
