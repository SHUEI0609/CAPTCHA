import { NextResponse } from 'next/server';
import { decryptToken } from '@/lib/captcha/crypto';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { verifyUserPassword } from '@/lib/auth/users';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const captchaToken = typeof body.captchaToken === 'string' ? body.captchaToken : '';

    if (!email || !password || !captchaToken) {
      return NextResponse.json(
        { success: false, message: 'Missing login credentials or CAPTCHA proof.' },
        { status: 400 }
      );
    }

    const user = await verifyUserPassword(email, password);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const captchaProof = decryptToken(captchaToken);
    if (
      !captchaProof ||
      !('purpose' in captchaProof) ||
      captchaProof.purpose !== 'captcha-proof' ||
      captchaProof.level !== 10 ||
      Date.now() > captchaProof.expiresAt
    ) {
      return NextResponse.json(
        { success: false, message: 'CAPTCHA verification has expired. Please retry.' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true, redirectTo: '/congratulations' });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: createSessionToken(user.email),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('Login Error:', error);
    if (error instanceof Error && error.message.includes('Supabase environment variables')) {
      return NextResponse.json(
        { success: false, message: 'Supabase environment variables are not configured.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, message: 'Login server error.' },
      { status: 500 }
    );
  }
}
