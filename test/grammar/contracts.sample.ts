// A representative LemmaScript file used as a grammar-tokenization snapshot
// fixture. Adapted from LemmaScript/examples. Every directive and spec construct
// the injection grammar recognizes should appear at least once below.

// An ordinary comment — must NOT be treated as an annotation.
// Contact me @home about this.

//@ pure
function occOf(arr: number[], x: number, n: number): number {
  //@ requires 0 <= n && n <= arr.length
  //@ decreases n
  //@ type n nat
  return n === 0 ? 0 : occOf(arr, x, n - 1) + (arr[n - 1] === x ? 1 : 0);
}

//@ verify
export function majority(arr: number[]): number {
  //@ requires forall(k: nat, k < arr.length ==> arr[k] >= 0)
  //@ ensures \result === -1 || (\result >= 0 && 2 * occOf(arr, \result, arr.length) > arr.length)
  //@ ensures (exists(x: nat, 2 * occOf(arr, x, arr.length) > arr.length)) ==> \result !== -1
  //@ type i nat
  let lo = 0;
  let hi = arr.length - 1;
  let result = -1;
  while (lo <= hi) {
    //@ invariant 0 <= lo && lo <= arr.length
    //@ invariant result === -1 || (result >= 0 && result < arr.length)
    //@ done_with result !== -1 || !(lo <= hi)
    //@ decreases (hi - lo + 1).toNat
    //@ assert lo <= hi
    result = lo;
    lo = lo + 1;
  }
  //@ ghost let witness = occOf(arr, result, arr.length)
  //@ assume result >= -1
  return result;
}

//@ declare-type Tool { name: string }
//@ backend dafny
//@ extern helper
//@ havoc
//@ autohavoc
//@ safe-slice
//@ assert-shaped
