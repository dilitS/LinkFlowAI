/**
 * Word-level diff for showing what a proofreading pass changed.
 *
 * Tokens are words and whitespace runs, so punctuation glued to a word
 * ("kot," → "kot.") shows as a single word replacement, which is what a
 * reader expects from a proofreading view.
 */

const MAX_CELLS = 4_000_000; // ~2000×2000 tokens; beyond that fall back to whole-text replace.

/** @param {string} text */
export function tokenize(text) {
    return text ? text.match(/\s+|[^\s]+/g) : [];
}

/**
 * @param {string} before
 * @param {string} after
 * @returns {Array<{ type: 'equal'|'insert'|'delete', text: string }>}
 *   Adjacent parts of the same type are merged.
 */
export function diffWords(before, after) {
    const a = tokenize(before);
    const b = tokenize(after);

    // Trim common prefix/suffix to keep the LCS table small.
    let start = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) start++;
    let endA = a.length;
    let endB = b.length;
    while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
        endA--;
        endB--;
    }

    const parts = [];
    const push = (type, text) => {
        if (!text) return;
        const last = parts[parts.length - 1];
        if (last && last.type === type) last.text += text;
        else parts.push({ type, text });
    };

    push('equal', a.slice(0, start).join(''));

    const midA = a.slice(start, endA);
    const midB = b.slice(start, endB);
    const n = midA.length;
    const m = midB.length;

    if (n * m > MAX_CELLS) {
        push('delete', midA.join(''));
        push('insert', midB.join(''));
    } else {
        // lcs[i][j] = LCS length of midA[i..] and midB[j..]
        const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
        for (let i = n - 1; i >= 0; i--) {
            for (let j = m - 1; j >= 0; j--) {
                lcs[i][j] = midA[i] === midB[j]
                    ? lcs[i + 1][j + 1] + 1
                    : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
            }
        }
        let i = 0;
        let j = 0;
        while (i < n && j < m) {
            if (midA[i] === midB[j]) {
                push('equal', midA[i]);
                i++;
                j++;
            } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
                push('delete', midA[i++]);
            } else {
                push('insert', midB[j++]);
            }
        }
        while (i < n) push('delete', midA[i++]);
        while (j < m) push('insert', midB[j++]);
    }

    push('equal', a.slice(endA).join(''));
    return groupChanges(parts);
}

/**
 * Reorder "delete ws insert" runs inside a change so a replaced phrase reads
 * as [old phrase][new phrase] instead of interleaved word-by-word, and drop
 * whitespace-only equal parts sandwiched between changes into both sides.
 */
function groupChanges(parts) {
    const out = [];
    let i = 0;
    while (i < parts.length) {
        if (parts[i].type === 'equal') {
            out.push(parts[i++]);
            continue;
        }
        let del = '';
        let ins = '';
        while (i < parts.length) {
            const p = parts[i];
            if (p.type === 'delete') del += p.text;
            else if (p.type === 'insert') ins += p.text;
            else if (/^\s+$/.test(p.text) && i + 1 < parts.length && parts[i + 1].type !== 'equal') {
                del += p.text;
                ins += p.text;
            } else break;
            i++;
        }
        if (del === ins) {
            out.push({ type: 'equal', text: del });
            continue;
        }
        if (del) out.push({ type: 'delete', text: del });
        if (ins) out.push({ type: 'insert', text: ins });
    }
    return out;
}

/**
 * Number of edit spots (a replacement counts once).
 * @param {ReturnType<typeof diffWords>} parts
 */
export function countChanges(parts) {
    let count = 0;
    for (let i = 0; i < parts.length; i++) {
        if (parts[i].type === 'equal') continue;
        count++;
        if (parts[i].type === 'delete' && parts[i + 1]?.type === 'insert') i++;
    }
    return count;
}
