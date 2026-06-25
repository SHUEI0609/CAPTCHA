'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Captcha from '@/components/Captcha/Captcha';
import styles from './page.module.css';

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaInstanceKey, setCaptchaInstanceKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleVerifySuccess = (token: string) => {
    setCaptchaToken(token);
    setLoginError(null);
  };

  const handleVerifyReset = () => {
    setCaptchaToken(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) return;

    setIsSubmitting(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          captchaToken,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setLoginError(data.message || 'ログインに失敗しました。');
        setCaptchaToken(null);
        setCaptchaInstanceKey((key) => key + 1);
        return;
      }

      router.push(data.redirectTo || '/congratulations');
    } catch (error) {
      console.error(error);
      setLoginError('サーバーとの通信中にエラーが発生しました。');
      setCaptchaToken(null);
      setCaptchaInstanceKey((key) => key + 1);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.mainContainer}>
      <div className={styles.formCard}>
        <>
          <div className={styles.cardHeader}>
            <h1 className={styles.title}>Secure Portal</h1>
            <p className={styles.subtitle}>COMPLETE VERIFICATION TO ACCESS</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.formGroup}>
            <div className={styles.inputWrapper}>
              <label className={styles.inputLabel} htmlFor="email">
                EMAIL ADDRESS
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="name@example.com"
                className={styles.inputField}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className={styles.inputWrapper}>
              <label className={styles.inputLabel} htmlFor="password">
                PASSWORD
              </label>
              <input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                className={styles.inputField}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className={styles.inputWrapper}>
              <label className={styles.inputLabel}>
                HUMAN VERIFICATION
              </label>
              <div className={styles.captchaWrapper}>
                <Captcha 
                  key={captchaInstanceKey}
                  onVerifySuccess={handleVerifySuccess} 
                  onVerifyReset={handleVerifyReset}
                />
              </div>
            </div>

            {loginError && (
              <div className={styles.errorMessage}>
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className={styles.submitButton}
              disabled={!captchaToken || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  LOGGING IN...
                </>
              ) : (
                <>
                  LOG IN
                </>
              )}
            </button>
          </form>
        </>
      </div>
    </main>
  );
}
