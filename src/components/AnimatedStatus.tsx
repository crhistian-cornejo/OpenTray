import { useState, useEffect, useRef } from "react";

interface AnimatedStatusProps {
  status: "idle" | "busy" | "retry";
}

// Knight Rider style animation - dots moving back and forth
const KNIGHT_WIDTH = 6;

export function AnimatedStatus({ status }: AnimatedStatusProps) {
  const [position, setPosition] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = right, -1 = left
  const [showCursor, setShowCursor] = useState(true);
  const [typedText, setTypedText] = useState("");
  const intervalRef = useRef<number | null>(null);

  // Typewriter effect for "Ready"
  useEffect(() => {
    if (status === "idle") {
      const text = "Ready";
      let i = 0;
      setTypedText("");
      
      const typeInterval = setInterval(() => {
        if (i <= text.length) {
          setTypedText(text.slice(0, i));
          i++;
        } else {
          clearInterval(typeInterval);
        }
      }, 80);

      // Cursor blink after typing
      const cursorInterval = setInterval(() => {
        setShowCursor(prev => !prev);
      }, 530);

      return () => {
        clearInterval(typeInterval);
        clearInterval(cursorInterval);
      };
    }
  }, [status]);

  // Knight Rider animation for busy/retry
  useEffect(() => {
    if (status === "busy" || status === "retry") {
      const speed = status === "busy" ? 60 : 100;
      
      intervalRef.current = window.setInterval(() => {
        setPosition(prev => {
          const next = prev + direction;
          if (next >= KNIGHT_WIDTH - 1) {
            setDirection(-1);
            return KNIGHT_WIDTH - 1;
          }
          if (next <= 0) {
            setDirection(1);
            return 0;
          }
          return next;
        });
      }, speed);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [status, direction]);

  // Reset when status changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on status change
  useEffect(() => {
    setPosition(0);
    setDirection(1);
  }, [status]);

  if (status === "idle") {
    return (
      <span className="animated-status idle">
        <span className="status-text">{typedText}</span>
        <span className={`cursor ${showCursor ? "visible" : ""}`}>_</span>
      </span>
    );
  }

  // Knight Rider dots
  const dots = Array.from({ length: KNIGHT_WIDTH }, (_, i) => {
    const distance = Math.abs(i - position);
    let className = "dot";
    
    if (distance === 0) {
      className += " active";
    } else if (distance === 1) {
      className += " trail-1";
    } else if (distance === 2) {
      className += " trail-2";
    }
    
    return (
      <span key={`dot-${i}`} className={className} />
    );
  });

  return (
    <span className={`animated-status ${status}`}>
      <span className="knight-rider">
        {dots}
      </span>
      <span className="status-label">
        {status === "retry" ? "Retrying" : ""}
      </span>
    </span>
  );
}
