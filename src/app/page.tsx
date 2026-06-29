'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Captcha from '@/components/Captcha/Captcha';
import styles from './page.module.css';

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaInstanceKey, setCaptchaInstanceKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleVerifySuccess = (token: string) => {
    setCaptchaToken(token);
    setLoginError(null);
    setInfoMessage(null);
  };

  const handleVerifyReset = () => {
    setCaptchaToken(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login' && !captchaToken) return;

    if (mode === 'register' && password !== confirmPassword) {
      setLoginError('確認用パスワードが一致しません。');
      return;
    }

    setIsSubmitting(true);
    setLoginError(null);
    setInfoMessage(null);

    try {
      const res = await fetch(mode === 'login' ? '/api/login' : '/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          captchaToken: mode === 'login' ? captchaToken : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setLoginError(data.message || (mode === 'login' ? 'ログインに失敗しました。' : '登録に失敗しました。'));
        if (mode === 'login') {
          setCaptchaToken(null);
          setCaptchaInstanceKey((key) => key + 1);
        }
        return;
      }

      if (mode === 'register') {
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setCaptchaToken(null);
        setCaptchaInstanceKey((key) => key + 1);
        setInfoMessage(data.message || '登録が完了しました。ログインしてください。');
        return;
      }

      router.push(data.redirectTo || '/congratulations');
    } catch (error) {
      console.error(error);
      setLoginError('サーバーとの通信中にエラーが発生しました。');
      if (mode === 'login') {
        setCaptchaToken(null);
        setCaptchaInstanceKey((key) => key + 1);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setLoginError(null);
    setInfoMessage(null);
    setPassword('');
    setConfirmPassword('');
    setCaptchaToken(null);
    setCaptchaInstanceKey((key) => key + 1);
  };

  return (
    <main className={styles.mainContainer}>
      <div className={styles.formCard}>
        <>
          <div className={styles.cardHeader}>
            <h1 className={styles.title}>Secure Portal</h1>
            <p className={styles.subtitle}>
              {mode === 'login' ? 'LOGIN' : 'REGISTER'}
            </p>
          </div>

          <div className={styles.modeSwitch} aria-label="auth mode">
            <button
              type="button"
              className={`${styles.modeButton} ${mode === 'login' ? styles.modeButtonActive : ''}`}
              onClick={() => switchMode('login')}
              disabled={isSubmitting}
            >
              LOG IN
            </button>
            <button
              type="button"
              className={`${styles.modeButton} ${mode === 'register' ? styles.modeButtonActive : ''}`}
              onClick={() => switchMode('register')}
              disabled={isSubmitting}
            >
              REGISTER
            </button>
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

            {mode === 'register' && (
              <div className={styles.inputWrapper}>
                <label className={styles.inputLabel} htmlFor="confirmPassword">
                  CONFIRM PASSWORD
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  placeholder="••••••••"
                  className={styles.inputField}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            )}

            {mode === 'login' && (
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
            )}

            {loginError && (
              <div className={styles.errorMessage}>
                {loginError}
              </div>
            )}

            {infoMessage && (
              <div className={styles.infoMessage}>
                {infoMessage}
              </div>
            )}

            <button
              type="submit"
              className={styles.submitButton}
              disabled={(mode === 'login' && !captchaToken) || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  {mode === 'login' ? 'LOGGING IN...' : 'REGISTERING...'}
                </>
              ) : (
                <>
                  {mode === 'login' ? 'LOG IN' : 'REGISTER'}
                </>
              )}
            </button>
          </form>
        </>
      </div>
    </main>
  );
}
