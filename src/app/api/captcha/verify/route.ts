import { NextResponse } from 'next/server';
import { decryptToken, encryptCaptchaProof } from '@/lib/captcha/crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, answerIndex, uiTime, level } = body;
    
    // Check for missing parameters
    if (token === undefined || answerIndex === undefined || uiTime === undefined || level === undefined) {
      return NextResponse.json(
        { success: false, message: 'Missing required parameters.' },
        { status: 400 }
      );
    }
    
    // 1. Decrypt token and verify integrity
    const payload = decryptToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, message: 'Invalid or tampered token.' },
        { status: 400 }
      );
    }
    
    // 2. Validate level consistency (prevent skipping levels)
    if ('purpose' in payload || payload.level !== level) {
      return NextResponse.json(
        { success: false, message: 'Security level mismatch.' },
        { status: 400 }
      );
    }
    
    // 3. Check for token expiration
    if (Date.now() > payload.expiresAt) {
      return NextResponse.json({
        success: false,
        message: 'CAPTCHA session has expired. Please refresh.',
      });
    }
    
    // 4. Bot prevention check: UI time threshold
    // Humans generally take at least 600ms to visually parse a layout and click.
    if (uiTime < 600) {
      console.warn(`Blocked verify request due to suspicious speed: ${uiTime}ms (BOT detected)`);
      return NextResponse.json({
        success: false,
        message: 'Verification failed. Response time was too fast.',
      });
    }
    
    // 5. Validate user selection
    if (answerIndex === payload.correctChoiceId) {
      return NextResponse.json({
        success: true,
        message: level === 10 
          ? 'Amazing! Verified level 10 successfully!' 
          : `Level ${level} verified.`,
        verificationToken: level === 10 ? encryptCaptchaProof(level) : undefined,
      });
    }
    
    return NextResponse.json({
      success: false,
      message: 'Incorrect selection. Restarting verification from Level 1.',
    });
  } catch (error) {
    console.error('CAPTCHA Verification Error:', error);
    return NextResponse.json(
      { success: false, message: 'Verification server error.' },
      { status: 500 }
    );
  }
}
