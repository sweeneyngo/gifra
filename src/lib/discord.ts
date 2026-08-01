/** Pull a string option value out of a command interaction. */
export function getOption(
  data: { options?: { name: string; value: unknown }[] },
  name: string,
): string | null {
  const opt = data.options?.find((o) => o.name === name);
  return typeof opt?.value === "string" ? opt.value : null;
}
