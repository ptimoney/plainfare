import styles from "./Tag.module.css";

interface TagProps {
  children: React.ReactNode;
}

export function Tag({ children }: TagProps) {
  return <span className={styles.tag}>{children}</span>;
}
