import DiffMatchPatch from "diff-match-patch";

export type PatchApplyResult =
  | { ok: true; text: string }
  | { ok: false; reason: "invalid_patch" | "hunk_failed" };

export function applyTextPatch(base: string, patchText: string): PatchApplyResult {
  const dmp = new DiffMatchPatch();
  let patches;
  try {
    patches = dmp.patch_fromText(patchText);
  } catch {
    return { ok: false, reason: "invalid_patch" };
  }
  const [text, results] = dmp.patch_apply(patches, base);
  if (results.some((r) => !r)) return { ok: false, reason: "hunk_failed" };
  return { ok: true, text };
}

export function makeTextPatch(before: string, after: string): string {
  const dmp = new DiffMatchPatch();
  return dmp.patch_toText(dmp.patch_make(before, after));
}
