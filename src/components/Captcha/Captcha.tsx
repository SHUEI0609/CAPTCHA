'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './Captcha.module.css';

interface CaptchaProps {
  onVerifySuccess: (token: string) => void;
  onVerifyReset: () => void;
}

export default function Captcha({ onVerifySuccess, onVerifyReset }: CaptchaProps) {
  // Checkbox and Modal state
  const [isVerified, setIsVerified] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Captcha levels progress (1 to 10)
  const [currentLevel, setCurrentLevel] = useState(1);
  
  const [token, setToken] = useState<string | null>(null);
  const [questionImage, setQuestionImage] = useState<string | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  
  // Timer settings
  const [timeLeft, setTimeLeft] = useState(180);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const loadTimeRef = useRef<number>(0);

  // Fetch puzzle for a specific level
  const fetchCaptcha = useCallback(async (levelToFetch: number) => {
    setIsLoading(true);
    setStatus('idle');
    setMessage(null);
    if (levelToFetch === 1) {
      onVerifyReset();
    }
    
    try {
      const res = await fetch(`/api/captcha/generate?level=${levelToFetch}`);
      if (!res.ok) throw new Error('Failed to load CAPTCHA');
      
      const data = await res.json();
      setToken(data.token);
      setQuestionImage(data.questionImage);
      setChoices(data.choices);
      
      // The final level is a hard reasoning puzzle, not a speed gimmick.
      const initialTime = levelToFetch === 10 ? 45 : 180;
      setTimeLeft(initialTime);
      loadTimeRef.current = Date.now();
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage('問題のロードに失敗しました。');
    } finally {
      setIsLoading(false);
    }
  }, [onVerifyReset]);

  // Trigger load on level changes when modal is open
  useEffect(() => {
    if (showModal) {
      const loadId = window.setTimeout(() => {
        fetchCaptcha(currentLevel);
      }, 0);

      return () => window.clearTimeout(loadId);
    }
  }, [currentLevel, fetchCaptcha, showModal]);

  // Cleanup timers on component unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Timer countdown hook
  useEffect(() => {
    if (!showModal || isLoading || status === 'success') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setStatus('error');
          setMessage('制限時間切れです。レベル1からやり直します。');
          // Wait a moment and reset to Level 1
          setTimeout(() => {
            setCurrentLevel(1);
            fetchCaptcha(1);
          }, 1500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchCaptcha, isLoading, status, currentLevel, showModal]);

  // Handle choice button click
  const handleChoiceClick = async (choiceIndex: number) => {
    if (isLoading || isSubmitting || status === 'success' || timeLeft === 0 || !token) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    
    // Calculate precise human interaction time
    // eslint-disable-next-line react-hooks/purity
    const uiTime = Date.now() - loadTimeRef.current;

    try {
      const res = await fetch('/api/captcha/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          answerIndex: choiceIndex,
          uiTime,
          level: currentLevel,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (currentLevel === 10) {
          // Passed the final level! CAPTCHA fully solved
          setStatus('success');
          setMessage('検証完了。人間離れした知性です！');
          onVerifySuccess(data.verificationToken);
          
          // Wait a moment for visual feedback before closing the modal
          setTimeout(() => {
            setShowModal(false);
            setIsVerified(true);
            setIsChecking(false);
          }, 1200);
        } else {
          // Level clear, advance to the next level
          const nextLvl = currentLevel + 1;
          setMessage(`LEVEL ${currentLevel} クリア。次の問題へ進みます...`);
          setCurrentLevel(nextLvl);
        }
      } else {
        // Failed: Reset everything back to Level 1
        setStatus('error');
        setMessage(data.message || '不正解。レベル1からやり直します。');
        setTimeout(() => {
          if (currentLevel === 1) {
            fetchCaptcha(1); // reload lvl 1
          } else {
            setCurrentLevel(1); // will trigger useEffect to reload lvl 1
          }
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage('サーバーとの通信中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualRefresh = () => {
    setCurrentLevel(1);
    fetchCaptcha(1);
  };

  const handleCheckboxClick = () => {
    if (isVerified || isChecking) return;
    setIsChecking(true);
    
    // Smooth loading spinner before popping up the challenge
    setTimeout(() => {
      setShowModal(true);
    }, 600);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setIsChecking(false);
    setCurrentLevel(1);
    onVerifyReset();
  };

  // Convert seconds to format
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return currentLevel === 10 
      ? `${seconds}s` 
      : `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* reCAPTCHA Checkbox Box Widget */}
      <div className={styles.recaptchaBox}>
        <div className={styles.recaptchaLeft}>
          <button
            type="button"
            className={`
              ${styles.checkbox}
              ${isChecking ? styles.checkboxChecking : ''}
              ${isVerified ? styles.checkboxVerified : ''}
            `}
            onClick={handleCheckboxClick}
            disabled={isVerified}
            aria-label="I'm not a robot checkbox"
          >
            {isChecking && !showModal && <div className={styles.checkboxSpinner} />}
            {isVerified && (
              <svg className={styles.checkmarkSvg} viewBox="0 0 24 24" fill="none" stroke="#009a44" strokeWidth="4">
                <polyline points="20 6 9 17 4 12" className={styles.checkmarkPath} />
              </svg>
            )}
          </button>
          <span className={styles.recaptchaText} onClick={handleCheckboxClick}>
            I&apos;m not a robot
          </span>
        </div>

        <div className={styles.recaptchaRight}>
          <div className={styles.logoWrapper}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2.5" className={styles.logoSvg}>
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </div>
          <span className={styles.logoText}>reCAPTCHA</span>
          <div className={styles.logoLinks}>
            <span className={styles.logoLink}>Privacy</span>
            <span className={styles.logoDivider}>-</span>
            <span className={styles.logoLink}>Terms</span>
          </div>
        </div>
      </div>

      {/* Challenge Modal Portal Overlay */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div 
              className={`
                ${styles.container} 
                ${status === 'success' ? styles.isSuccess : ''} 
                ${status === 'error' ? styles.isError : ''}
              `}
            >
              {/* Header */}
              <div className={styles.header}>
                <div className={styles.headerInfo}>
                  <span className={styles.securityBadge}>
                    LEVEL {currentLevel}/10
                  </span>
                  <span className={`
                    ${styles.timer} 
                    ${currentLevel === 10 ? styles.timerImpossible : ''} 
                    ${timeLeft < 5 && currentLevel === 10 ? styles.timerAlert : ''}
                  `}>
                    TIME: {formatTime(timeLeft)}
                  </span>
                </div>
                <div className={styles.headerActions}>
                  <button 
                    onClick={handleManualRefresh} 
                    className={styles.refreshButton}
                    disabled={isLoading || isSubmitting}
                    aria-label="パズルを初期状態からリフレッシュ"
                    type="button"
                  >
                    <svg 
                      className={isLoading ? styles.spinning : ''} 
                      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    >
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                  </button>
                  <button 
                    onClick={handleCloseModal} 
                    className={styles.closeButton}
                    aria-label="認証画面を閉じる"
                    type="button"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              <p className={styles.instruction}>
                {currentLevel === 10 ? (
                  <strong className={styles.impossibleWarning}>[最終問題: 超高難度] 複数の法則を同時に推理してください。</strong>
                ) : (
                  <span>最後の「？」に入る答えを以下から選択してください。</span>
                )}
              </p>

              {/* Main Grid */}
              <div className={styles.puzzleArea}>
                {isLoading ? (
                  <div className={styles.skeletonGrid}>
                    <div className={styles.shimmerEffect} />
                  </div>
                ) : (
                  questionImage && (
                    <div className={styles.imageContainer}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={questionImage} 
                        alt="CAPTCHA Challenge" 
                        className={styles.puzzleImage} 
                        draggable="false"
                      />
                    </div>
                  )
                )}
              </div>

              {/* Choices Area */}
              <div className={styles.choicesArea}>
                {isLoading ? (
                  <div className={styles.skeletonChoices}>
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className={styles.skeletonChoiceItem}>
                        <div className={styles.shimmerEffect} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.choicesGrid}>
                    {choices.map((choiceSrc, index) => (
                      <button
                        key={index}
                        onClick={() => handleChoiceClick(index)}
                        className={`${styles.choiceButton} ${isSubmitting ? styles.disabled : ''}`}
                        disabled={isLoading || isSubmitting || status === 'success' || timeLeft === 0}
                        aria-label={`Choice ${String.fromCharCode(65 + index)}`}
                        type="button"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={choiceSrc} 
                          alt={`Choice ${index + 1}`} 
                          className={styles.choiceImage}
                          draggable="false"
                        />
                        <span className={styles.choiceLabel}>{String.fromCharCode(65 + index)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Messages */}
              {message && (
                <div className={`
                  ${styles.messageBox}
                  ${status === 'success' ? styles.messageSuccess : ''}
                  ${status === 'error' ? styles.messageError : ''}
                `}>
                  <span className={styles.messageText}>{message}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
