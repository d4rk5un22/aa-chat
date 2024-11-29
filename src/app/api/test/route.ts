import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Test authentication
    const session = await getAuthSession();
    console.log("Auth session test:", {
      authenticated: !!session?.user,
      userId: session?.user?.id
    });

    // Test MongoDB connection
    const client = await clientPromise;
    const db = client.db();
    const collections = await db.listCollections().toArray();
    console.log("MongoDB connection test:", {
      connected: true,
      collections: collections.map(c => c.name)
    });

    return NextResponse.json({
      status: 'ok',
      auth: {
        authenticated: !!session?.user,
        userId: session?.user?.id
      },
      mongodb: {
        connected: true,
        collections: collections.map(c => c.name)
      }
    });
  } catch (error) {
    console.error("API test error:", error);
    return NextResponse.json(
      { 
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
