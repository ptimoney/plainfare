import { Link, type LinkProps } from "react-router-dom";
import styles from "./Card.module.css";

interface CardProps extends Omit<LinkProps, "className"> {
  className?: string;
}

export function Card({ className, ...props }: CardProps) {
  return <Link className={[styles.card, className].filter(Boolean).join(" ")} {...props} />;
}
