function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isKnownPokeRogueHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "pokerogue.net" || host.endsWith(".pokerogue.net");
}

export function isLikelyPokeRoguePage(hostname: string, title: string): boolean {
  if (isKnownPokeRogueHost(hostname)) return true;
  return normalize(title).includes("pokerogue");
}
