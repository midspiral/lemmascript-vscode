// Grammar edge cases.

// An escaped quote inside a spec string must not let the string scope run past
// the closing quote — the `\"` is an escape, and `&& x > 0` stays tokenized.
//@ ensures s === "a\"b" && x > 0
