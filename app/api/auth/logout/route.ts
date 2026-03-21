import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ message: 'Logged out' });
  
  response.cookies.set('auth_token', '', { expires: new Date(0), path: '/' });
  response.cookies.set('user_id', '', { expires: new Date(0), path: '/' });
  
  return response;
}
