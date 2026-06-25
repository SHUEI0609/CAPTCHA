import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  generatePuzzle,
  renderQuestionSvg,
  renderChoiceSvg,
  rasterizeSvg,
} from '@/lib/captcha/generator';
import { encryptToken } from '@/lib/captcha/crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Parse level from query parameters (default to 1)
    const { searchParams } = new URL(request.url);
    const levelParam = searchParams.get('level');
    const level = levelParam ? parseInt(levelParam, 10) : 1;
    
    // Enforce valid level boundaries [1, 10]
    const safeLevel = isNaN(level) || level < 1 || level > 10 ? 1 : level;
    
    // 1. Generate a level-specific shape matrix puzzle config
    const puzzle = generatePuzzle(safeLevel);
    
    // 2. Render SVG strings with correct level settings
    const questionSvg = renderQuestionSvg(puzzle.grid, safeLevel);
    const choicesSvgs = puzzle.choices.map((choice) => renderChoiceSvg(choice));
    
    // 3. Rasterize SVGs to PNG Base64 images in parallel (with SVG fallback)
    const [questionImage, ...choicesImages] = await Promise.all([
      rasterizeSvg(questionSvg),
      ...choicesSvgs.map((svg) => rasterizeSvg(svg)),
    ]);
    
    // 4. Create and encrypt token with level validation
    const now = Date.now();
    // Level 10 is intentionally difficult, but still allows enough time for real reasoning.
    const duration = safeLevel === 10 ? 45 * 1000 : 3 * 60 * 1000;
    const expiresAt = now + duration;
    const salt = crypto.randomBytes(8).toString('hex');
    
    const token = encryptToken({
      correctChoiceId: puzzle.correctChoiceIndex,
      level: safeLevel,
      expiresAt,
      issuedAt: now,
      salt,
    });
    
    return NextResponse.json({
      token,
      questionImage,
      choices: choicesImages,
    });
  } catch (error) {
    console.error('CAPTCHA Generation Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate CAPTCHA' },
      { status: 500 }
    );
  }
}
