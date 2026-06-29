import { NextResponse } from 'next/server';
import { createUser } from '@/lib/auth/users';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required.' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { success: false, message: 'Password must be at least 4 characters.' },
        { status: 400 }
      );
    }

    const result = await createUser(email, password);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: 'This email is already registered.' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Registration complete. Please log in.',
    });
  } catch (error) {
    console.error('Register Error:', error);
    if (error instanceof Error && error.message.includes('Supabase environment variables')) {
      return NextResponse.json(
        { success: false, message: 'Supabase environment variables are not configured.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, message: 'Registration server error.' },
      { status: 500 }
    );
  }
}
