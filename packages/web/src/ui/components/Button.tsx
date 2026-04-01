import styles from "./Button.module.css";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  const cls = [styles.button, styles[variant], className].filter(Boolean).join(" ");
  return <button className={cls} {...props} />;
}
