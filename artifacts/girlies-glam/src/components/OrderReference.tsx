import React from "react";

type OrderReferenceProps = {
  value: string;
  className?: string;
};

export function OrderReference({ value, className = "" }: OrderReferenceProps) {
  const classes = ["gg-order-reference", className].filter(Boolean).join(" ");
  return <span className={classes}>{value}</span>;
}