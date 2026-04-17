
export function cn(...classNames: Array<undefined | null | string | boolean>) {
  return classNames
    .flat()
    .filter(x => typeof x === "string")
    .join(" ")
    .trim()
}