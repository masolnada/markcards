export function calcProgress(reviewed: number, total: number): number {
  return total > 0 ? (reviewed / total) * 100 : 0;
}
