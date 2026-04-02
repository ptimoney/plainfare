import { useState } from "react";
import styles from "./RecipeImage.module.css";

interface RecipeImageProps {
  src?: string;
  alt: string;
  className?: string;
}

function Placeholder({ className }: { className?: string }) {
  return (
    <div className={`${styles.placeholder} ${className ?? ""}`}>
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Fork */}
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
        <path d="M7 2v20" />
        <path d="M3 6h8" />
        {/* Knife */}
        <path d="M17 2c0 4-2 7-2 10h4c0-3-2-6-2-10z" />
        <path d="M17 12v10" />
      </svg>
    </div>
  );
}

function resolveImageSrc(src: string): string {
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) {
    return src;
  }
  return `/recipes-images/${src}`;
}

export function RecipeImage({ src, alt, className }: RecipeImageProps) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return <Placeholder className={className} />;
  }

  return (
    <img
      className={className}
      src={resolveImageSrc(src)}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}
