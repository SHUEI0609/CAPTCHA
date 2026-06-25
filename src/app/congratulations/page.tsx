import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';

export default async function CongratulationsPage() {
  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(sessionToken);

  if (!session) {
    redirect('/');
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        color: '#000000',
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: '32px',
          fontWeight: 700,
          letterSpacing: 0,
        }}
      >
        おめでとう
      </h1>
    </main>
  );
}

