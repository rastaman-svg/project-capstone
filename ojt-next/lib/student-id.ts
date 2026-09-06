/** Direct port of course_initials() from the PHP version — turns a
 * course/strand name into a short uppercase code for the Student ID
 * prefix, e.g. "BS Information Technology" -> "BSIT". */
export function courseInitials(courseText: string): string {
  const words = courseText.trim().toUpperCase().match(/[A-Z]+/g);
  if (!words || words.length === 0) return "GEN";
  if (words.length === 1) return words[0].slice(0, 8);

  const STOPWORDS = new Set(["OF", "AND", "IN", "THE", "FOR", "AT", "TO"]);
  const prefix = words[0].length <= 3 ? words[0] : words[0][0];
  const restInitials = words
    .slice(1)
    .filter((w) => !STOPWORDS.has(w))
    .map((w) => w[0])
    .join("");
  const code = (prefix + restInitials).slice(0, 8);
  return code || "GEN";
}
