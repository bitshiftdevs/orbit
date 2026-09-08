// Fractional-index ranking. Ranks are variable-length base36 strings compared
// lexicographically; midpoint(a, b) returns a string strictly between them
// without needing to touch its neighbours. Handles the drag-and-drop board
// reorder without rewriting every issue on move.

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const MIN = ALPHABET[0];
const MAX = ALPHABET[ALPHABET.length - 1];

function charAt(s: string, i: number, pad: string): string {
	return i < s.length ? s[i] : pad;
}

export function midpoint(a: string | null, b: string | null): string {
	const lo = a ?? "";
	const hi = b ?? "";
	if (lo && hi && lo >= hi) {
		throw new Error(`rank order: ${lo} >= ${hi}`);
	}
	let i = 0;
	let prefix = "";
	while (true) {
		const l = charAt(lo, i, MIN);
		const h = charAt(hi, i, MAX);
		if (l === h) {
			prefix += l;
			i++;
			continue;
		}
		const li = ALPHABET.indexOf(l);
		const hi_ = ALPHABET.indexOf(h);
		if (hi_ - li > 1) {
			const mid = ALPHABET[Math.floor((li + hi_) / 2)];
			return prefix + mid;
		}
		// Neighbours differ by one — descend into the low side and pick a mid
		// there.
		prefix += l;
		i++;
		let j = i;
		while (true) {
			const lc = charAt(lo, j, MIN);
			if (lc !== MAX) {
				const mid =
					ALPHABET[Math.floor((ALPHABET.indexOf(lc) + ALPHABET.length) / 2)];
				return prefix + lo.slice(i, j) + mid;
			}
			prefix += MAX;
			j++;
		}
	}
}

export function initialRank(): string {
	return "m";
}
