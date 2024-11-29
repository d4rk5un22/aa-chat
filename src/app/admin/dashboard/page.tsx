"use client"

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { useState, useEffect } from "react"
import { DocumentUpload } from "@/components/document-upload"
import { DocumentList } from "@/components/document-list"
import type { Document } from "@/types/document"

interface User {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: "admin" | "user"
  status: "pending" | "approved" | "rejected"
  createdAt: string
}

export default function AdminDashboard() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/')
    }
  })

  const [documents, setDocuments] = useState<Document[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'documents' | 'users'>('documents')

  // Verify admin role
  useEffect(() => {
    if (session?.user?.role !== 'admin') {
      redirect('/')
    }
  }, [session])

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/documents')
      if (!response.ok) {
        throw new Error('Failed to fetch documents')
      }
      const data = await response.json()
      setDocuments(data)
      setError(null)
    } catch (error) {
      console.error('Error fetching documents:', error)
      setError('Failed to load documents')
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }
      const data = await response.json()
      console.log('Fetched users:', data)
      setUsers(data)
      setError(null)
    } catch (error) {
      console.error('Error fetching users:', error)
      setError('Failed to load users')
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchDocuments()
      fetchUsers()
      setLoading(false)
    }
  }, [status])

  const handleUserAction = async (userId: string, action: 'approve' | 'delete') => {
    try {
      setError(null);
      let response;
      console.log('Attempting user action:', { userId, action });
      
      if (action === 'delete') {
        response = await fetch(`/api/users?userId=${userId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          },
        });
      } else {
        console.log('Sending status update request');
        response = await fetch(`/api/users?userId=${userId}&action=${action}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          },
        });
      }

      const responseText = await response.text();
      let result;
      
      try {
        result = responseText ? JSON.parse(responseText) : {};
        console.log('Parsed response:', result);
      } catch (e) {
        console.error('Failed to parse response:', responseText);
        throw new Error(`Failed to process server response: ${responseText}`);
      }

      if (!response.ok) {
        const errorMessage = result?.message || result?.error || 'Operation failed';
        console.error('Server response error:', {
          status: response.status,
          statusText: response.statusText,
          error: result,
          text: responseText
        });
        throw new Error(errorMessage);
      }

      console.log('Server response success:', result);

      // Refresh users list immediately
      await fetchUsers();

      // Show success message
      const message = result.message || (
        action === 'approve' ? 'User approved successfully' : 
        'User deleted successfully'
      );
      
      // Use toast notification if available
      if (typeof window !== 'undefined' && window?.Notification?.permission === 'granted') {
        new Notification(message);
      }

    } catch (error) {
      console.error('Error updating user:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      
      // Still refresh the users list as the operation might have succeeded
      try {
        await fetchUsers();
      } catch (fetchError) {
        console.error('Error refreshing users list:', fetchError);
      }
    }
  };

  const renderUserActions = (user: User) => {
    if (user.role === 'admin') return null;

    return (
      <div className="flex justify-end space-x-2">
        {user.status === 'pending' && (
          <button
            onClick={() => handleUserAction(user.id, 'approve')}
            className="px-3 py-1 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700"
          >
            Approve
          </button>
        )}
        <button
          onClick={() => handleUserAction(user.id, 'delete')}
          className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700"
        >
          Delete
        </button>
      </div>
    );
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('documents')}
              className={`${
                activeTab === 'documents'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Documents
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`${
                activeTab === 'users'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Users
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'documents' ? (
        <div className="space-y-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Upload New Document</h2>
            <DocumentUpload onUploadSuccess={fetchDocuments} />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Manage Documents</h2>
            {error ? (
              <div className="bg-red-50 dark:bg-red-900/50 text-red-700 dark:text-red-200 p-4 rounded-lg mb-4">
                {error}
                <button
                  onClick={fetchDocuments}
                  className="ml-4 bg-red-100 dark:bg-red-900 px-3 py-1 rounded hover:bg-red-200 dark:hover:bg-red-800"
                >
                  Retry
                </button>
              </div>
            ) : (
              <DocumentList documents={documents} onDocumentDeleted={fetchDocuments} />
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="sm:flex sm:items-center p-6">
            <div className="sm:flex-auto">
              <h2 className="text-xl font-semibold">User Management</h2>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                Manage user access and approval status
              </p>
            </div>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">User</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Email</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Status</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Joined</th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {users.map((user, index) => (
                    <tr key={`${user.id}-${index}`}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                        <div className="flex items-center">
                          {user.image && (
                            <img src={user.image} alt="" className="h-8 w-8 rounded-full" />
                          )}
                          <div className="ml-4">
                            <div className="font-medium text-gray-900 dark:text-gray-100">{user.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {user.email}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          user.status === 'approved'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : user.status === 'rejected'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium">
                        {renderUserActions(user)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
