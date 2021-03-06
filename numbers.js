var JSBigInt = (function () {
    "use strict";
    /*
     Class: BigInteger
     An arbitrarily-large integer.

     <BigInteger> objects should be considered immutable. None of the "built-in"
     methods modify *this* or their arguments. All properties should be
     considered private.

     All the methods of <BigInteger> instances can be called "statically". The
     static versions are convenient if you don't already have a <BigInteger>
     object.

     As an example, these calls are equivalent.

     > BigInteger(4).multiply(5); // returns BigInteger(20);
     > BigInteger.multiply(4, 5); // returns BigInteger(20);

     > var a = 42;
     > var a = BigInteger.toJSValue("0b101010"); // Not completely useless...
     */

    var CONSTRUCT = {}; // Unique token to call "private" version of constructor

    /*
     Constructor: BigInteger()
     Convert a value to a <BigInteger>.

     Although <BigInteger()> is the constructor for <BigInteger> objects, it is
     best not to call it as a constructor. If *n* is a <BigInteger> object, it is
     simply returned as-is. Otherwise, <BigInteger()> is equivalent to <parse>
     without a radix argument.

     > var n0 = BigInteger();      // Same as <BigInteger.ZERO>
     > var n1 = BigInteger("123"); // Create a new <BigInteger> with value 123
     > var n2 = BigInteger(123);   // Create a new <BigInteger> with value 123
     > var n3 = BigInteger(n2);    // Return n2, unchanged

     The constructor form only takes an array and a sign. *n* must be an
     array of numbers in little-endian order, where each digit is between 0
     and BigInteger.base.  The second parameter sets the sign: -1 for
     negative, +1 for positive, or 0 for zero. The array is *not copied and
     may be modified*. If the array contains only zeros, the sign parameter
     is ignored and is forced to zero.

     > new BigInteger([5], -1): create a new BigInteger with value -5

     Parameters:

     n - Value to convert to a <BigInteger>.

     Returns:

     A <BigInteger> value.

     See Also:

     <parse>, <BigInteger>
     */
    function BigInteger(n, s, token) {
        if (token !== CONSTRUCT) {
            if (n instanceof BigInteger) {
                return n;
            } else if (typeof n === "undefined") {
                return ZERO;
            }
            return BigInteger.parse(n);
        }

        n = n || []; // Provide the nullary constructor for subclasses.
        while (n.length && !n[n.length - 1]) {
            --n.length;
        }
        this._d = n;
        this._s = n.length ? (s || 1) : 0;
    }

    BigInteger._construct = function (n, s) {
        return new BigInteger(n, s, CONSTRUCT);
    };

    // Base-10 speedup hacks in parse, toString, exp10 and log functions
    // require base to be a power of 10. 10^7 is the largest such power
    // that won't cause a precision loss when digits are multiplied.
    var BigInteger_base = 10000000;
    var BigInteger_base_log10 = 7;

    BigInteger.base = BigInteger_base;
    BigInteger.base_log10 = BigInteger_base_log10;

    var ZERO = new BigInteger([], 0, CONSTRUCT);
    // Constant: ZERO
    // <BigInteger> 0.
    BigInteger.ZERO = ZERO;

    var ONE = new BigInteger([1], 1, CONSTRUCT);
    // Constant: ONE
    // <BigInteger> 1.
    BigInteger.ONE = ONE;

    var M_ONE = new BigInteger(ONE._d, -1, CONSTRUCT);
    // Constant: M_ONE
    // <BigInteger> -1.
    BigInteger.M_ONE = M_ONE;

    // Constant: _0
    // Shortcut for <ZERO>.
    BigInteger._0 = ZERO;

    // Constant: _1
    // Shortcut for <ONE>.
    BigInteger._1 = ONE;

    /*
     Constant: small
     Array of <BigIntegers> from 0 to 36.

     These are used internally for parsing, but useful when you need a "small"
     <BigInteger>.

     See Also:

     <ZERO>, <ONE>, <_0>, <_1>
     */
    BigInteger.small = [
        ZERO,
        ONE,
        /* Assuming BigInteger_base > 36 */
        new BigInteger([2], 1, CONSTRUCT),
        new BigInteger([3], 1, CONSTRUCT),
        new BigInteger([4], 1, CONSTRUCT),
        new BigInteger([5], 1, CONSTRUCT),
        new BigInteger([6], 1, CONSTRUCT),
        new BigInteger([7], 1, CONSTRUCT),
        new BigInteger([8], 1, CONSTRUCT),
        new BigInteger([9], 1, CONSTRUCT),
        new BigInteger([10], 1, CONSTRUCT),
        new BigInteger([11], 1, CONSTRUCT),
        new BigInteger([12], 1, CONSTRUCT),
        new BigInteger([13], 1, CONSTRUCT),
        new BigInteger([14], 1, CONSTRUCT),
        new BigInteger([15], 1, CONSTRUCT),
        new BigInteger([16], 1, CONSTRUCT),
        new BigInteger([17], 1, CONSTRUCT),
        new BigInteger([18], 1, CONSTRUCT),
        new BigInteger([19], 1, CONSTRUCT),
        new BigInteger([20], 1, CONSTRUCT),
        new BigInteger([21], 1, CONSTRUCT),
        new BigInteger([22], 1, CONSTRUCT),
        new BigInteger([23], 1, CONSTRUCT),
        new BigInteger([24], 1, CONSTRUCT),
        new BigInteger([25], 1, CONSTRUCT),
        new BigInteger([26], 1, CONSTRUCT),
        new BigInteger([27], 1, CONSTRUCT),
        new BigInteger([28], 1, CONSTRUCT),
        new BigInteger([29], 1, CONSTRUCT),
        new BigInteger([30], 1, CONSTRUCT),
        new BigInteger([31], 1, CONSTRUCT),
        new BigInteger([32], 1, CONSTRUCT),
        new BigInteger([33], 1, CONSTRUCT),
        new BigInteger([34], 1, CONSTRUCT),
        new BigInteger([35], 1, CONSTRUCT),
        new BigInteger([36], 1, CONSTRUCT)
    ];

    // Used for parsing/radix conversion
    BigInteger.digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

    /*
     Method: toString
     Convert a <BigInteger> to a string.

     When *base* is greater than 10, letters are upper case.

     Parameters:

     base - Optional base to represent the number in (default is base 10).
     Must be between 2 and 36 inclusive, or an Error will be thrown.

     Returns:

     The string representation of the <BigInteger>.
     */
    BigInteger.prototype.toString = function (base) {
        base = +base || 10;
        if (base < 2 || base > 36) {
            throw new Error("illegal radix " + base + ".");
        }
        if (this._s === 0) {
            return "0";
        }
        if (base === 10) {
            var str = this._s < 0 ? "-" : "";
            str += this._d[this._d.length - 1].toString();
            for (var i = this._d.length - 2; i >= 0; i--) {
                var group = this._d[i].toString();
                while (group.length < BigInteger_base_log10) group = '0' + group;
                str += group;
            }
            return str;
        } else {
            var numerals = BigInteger.digits;
            base = BigInteger.small[base];
            var sign = this._s;

            var n = this.abs();
            var digits = [];
            var digit;

            while (n._s !== 0) {
                var divmod = n.divRem(base);
                n = divmod[0];
                digit = divmod[1];
                // TODO: This could be changed to unshift instead of reversing at the end.
                // Benchmark both to compare speeds.
                digits.push(numerals[digit.valueOf()]);
            }
            return (sign < 0 ? "-" : "") + digits.reverse().join("");
        }
    };

    // Verify strings for parsing
    BigInteger.radixRegex = [
        /^$/,
        /^$/,
        /^[01]*$/,
        /^[012]*$/,
        /^[0-3]*$/,
        /^[0-4]*$/,
        /^[0-5]*$/,
        /^[0-6]*$/,
        /^[0-7]*$/,
        /^[0-8]*$/,
        /^[0-9]*$/,
        /^[0-9aA]*$/,
        /^[0-9abAB]*$/,
        /^[0-9abcABC]*$/,
        /^[0-9a-dA-D]*$/,
        /^[0-9a-eA-E]*$/,
        /^[0-9a-fA-F]*$/,
        /^[0-9a-gA-G]*$/,
        /^[0-9a-hA-H]*$/,
        /^[0-9a-iA-I]*$/,
        /^[0-9a-jA-J]*$/,
        /^[0-9a-kA-K]*$/,
        /^[0-9a-lA-L]*$/,
        /^[0-9a-mA-M]*$/,
        /^[0-9a-nA-N]*$/,
        /^[0-9a-oA-O]*$/,
        /^[0-9a-pA-P]*$/,
        /^[0-9a-qA-Q]*$/,
        /^[0-9a-rA-R]*$/,
        /^[0-9a-sA-S]*$/,
        /^[0-9a-tA-T]*$/,
        /^[0-9a-uA-U]*$/,
        /^[0-9a-vA-V]*$/,
        /^[0-9a-wA-W]*$/,
        /^[0-9a-xA-X]*$/,
        /^[0-9a-yA-Y]*$/,
        /^[0-9a-zA-Z]*$/
    ];

    /*
     Function: parse
     Parse a string into a <BigInteger>.

     *base* is optional but, if provided, must be from 2 to 36 inclusive. If
     *base* is not provided, it will be guessed based on the leading characters
     of *s* as follows:

     - "0x" or "0X": *base* = 16
     - "0c" or "0C": *base* = 8
     - "0b" or "0B": *base* = 2
     - else: *base* = 10

     If no base is provided, or *base* is 10, the number can be in exponential
     form. For example, these are all valid:

     > BigInteger.parse("1e9");              // Same as "1000000000"
     > BigInteger.parse("1.234*10^3");       // Same as 1234
     > BigInteger.parse("56789 * 10 ** -2"); // Same as 567

     If any characters fall outside the range defined by the radix, an exception
     will be thrown.

     Parameters:

     s - The string to parse.
     base - Optional radix (default is to guess based on *s*).

     Returns:

     a <BigInteger> instance.
     */
    BigInteger.parse = function (s, base) {
        // Expands a number in exponential form to decimal form.
        // expandExponential("-13.441*10^5") === "1344100";
        // expandExponential("1.12300e-1") === "0.112300";
        // expandExponential(1000000000000000000000000000000) === "1000000000000000000000000000000";
        function expandExponential(str) {
            str = str.replace(/\s*[*xX]\s*10\s*(\^|\*\*)\s*/, "e");

            return str.replace(/^([+\-])?(\d+)\.?(\d*)[eE]([+\-]?\d+)$/, function (x, s, n, f, c) {
                c = +c;
                var l = c < 0;
                var i = n.length + c;
                x = (l ? n : f).length;
                c = ((c = Math.abs(c)) >= x ? c - x + l : 0);
                var z = (new Array(c + 1)).join("0");
                var r = n + f;
                return (s || "") + (l ? r = z + r : r += z).substr(0, i += l ? z.length : 0) + (i < r.length ? "." + r.substr(i) : "");
            });
        }

        s = s.toString();
        if (typeof base === "undefined" || +base === 10) {
            s = expandExponential(s);
        }

        var prefixRE;
        if (typeof base === "undefined") {
            prefixRE = '0[xcb]';
        } else if (base == 16) {
            prefixRE = '0x';
        } else if (base == 8) {
            prefixRE = '0c';
        } else if (base == 2) {
            prefixRE = '0b';
        } else {
            prefixRE = '';
        }
        var parts = new RegExp('^([+\\-]?)(' + prefixRE + ')?([0-9a-z]*)(?:\\.\\d*)?$', 'i').exec(s);
        if (parts) {
            var sign = parts[1] || "+";
            var baseSection = parts[2] || "";
            var digits = parts[3] || "";

            if (typeof base === "undefined") {
                // Guess base
                if (baseSection === "0x" || baseSection === "0X") { // Hex
                    base = 16;
                } else if (baseSection === "0c" || baseSection === "0C") { // Octal
                    base = 8;
                } else if (baseSection === "0b" || baseSection === "0B") { // Binary
                    base = 2;
                } else {
                    base = 10;
                }
            } else if (base < 2 || base > 36) {
                throw new Error("Illegal radix " + base + ".");
            }

            base = +base;

            // Check for digits outside the range
            if (!(BigInteger.radixRegex[base].test(digits))) {
                throw new Error("Bad digit for radix " + base);
            }

            // Strip leading zeros, and convert to array
            digits = digits.replace(/^0+/, "").split("");
            if (digits.length === 0) {
                return ZERO;
            }

            // Get the sign (we know it's not zero)
            sign = (sign === "-") ? -1 : 1;

            // Optimize 10
            if (base == 10) {
                var d = [];
                while (digits.length >= BigInteger_base_log10) {
                    d.push(parseInt(digits.splice(digits.length - BigInteger.base_log10, BigInteger.base_log10).join(''), 10));
                }
                d.push(parseInt(digits.join(''), 10));
                return new BigInteger(d, sign, CONSTRUCT);
            }

            // Do the conversion
            var d = ZERO;
            base = BigInteger.small[base];
            var small = BigInteger.small;
            for (var i = 0; i < digits.length; i++) {
                d = d.multiply(base).add(small[parseInt(digits[i], 36)]);
            }
            return new BigInteger(d._d, sign, CONSTRUCT);
        } else {
            throw new Error("Invalid BigInteger format: " + s);
        }
    };

    /*
     Function: add
     Add two <BigIntegers>.

     Parameters:

     n - The number to add to *this*. Will be converted to a <BigInteger>.

     Returns:

     The numbers added together.

     See Also:

     <subtract>, <multiply>, <quotient>, <next>
     */
    BigInteger.prototype.add = function (n) {
        if (this._s === 0) {
            return BigInteger(n);
        }

        n = BigInteger(n);
        if (n._s === 0) {
            return this;
        }
        if (this._s !== n._s) {
            n = n.negate();
            return this.subtract(n);
        }

        var a = this._d;
        var b = n._d;
        var al = a.length;
        var bl = b.length;
        var sum = new Array(Math.max(al, bl) + 1);
        var size = Math.min(al, bl);
        var carry = 0;
        var digit;

        for (var i = 0; i < size; i++) {
            digit = a[i] + b[i] + carry;
            sum[i] = digit % BigInteger_base;
            carry = (digit / BigInteger_base) | 0;
        }
        if (bl > al) {
            a = b;
            al = bl;
        }
        for (i = size; carry && i < al; i++) {
            digit = a[i] + carry;
            sum[i] = digit % BigInteger_base;
            carry = (digit / BigInteger_base) | 0;
        }
        if (carry) {
            sum[i] = carry;
        }

        for (; i < al; i++) {
            sum[i] = a[i];
        }

        return new BigInteger(sum, this._s, CONSTRUCT);
    };

    /*
     Function: negate
     Get the additive inverse of a <BigInteger>.

     Returns:

     A <BigInteger> with the same magnatude, but with the opposite sign.

     See Also:

     <abs>
     */
    BigInteger.prototype.negate = function () {
        return new BigInteger(this._d, (-this._s) | 0, CONSTRUCT);
    };

    /*
     Function: abs
     Get the absolute value of a <BigInteger>.

     Returns:

     A <BigInteger> with the same magnatude, but always positive (or zero).

     See Also:

     <negate>
     */
    BigInteger.prototype.abs = function () {
        return (this._s < 0) ? this.negate() : this;
    };

    /*
     Function: subtract
     Subtract two <BigIntegers>.

     Parameters:

     n - The number to subtract from *this*. Will be converted to a <BigInteger>.

     Returns:

     The *n* subtracted from *this*.

     See Also:

     <add>, <multiply>, <quotient>, <prev>
     */
    BigInteger.prototype.subtract = function (n) {
        if (this._s === 0) {
            return BigInteger(n).negate();
        }

        n = BigInteger(n);
        if (n._s === 0) {
            return this;
        }
        if (this._s !== n._s) {
            n = n.negate();
            return this.add(n);
        }

        var m = this;
        // negative - negative => -|a| - -|b| => -|a| + |b| => |b| - |a|
        if (this._s < 0) {
            m = new BigInteger(n._d, 1, CONSTRUCT);
            n = new BigInteger(this._d, 1, CONSTRUCT);
        }

        // Both are positive => a - b
        var sign = m.compareAbs(n);
        if (sign === 0) {
            return ZERO;
        } else if (sign < 0) {
            // swap m and n
            var t = n;
            n = m;
            m = t;
        }

        // a > b
        var a = m._d;
        var b = n._d;
        var al = a.length;
        var bl = b.length;
        var diff = new Array(al); // al >= bl since a > b
        var borrow = 0;
        var i;
        var digit;

        for (i = 0; i < bl; i++) {
            digit = a[i] - borrow - b[i];
            if (digit < 0) {
                digit += BigInteger_base;
                borrow = 1;
            } else {
                borrow = 0;
            }
            diff[i] = digit;
        }
        for (i = bl; i < al; i++) {
            digit = a[i] - borrow;
            if (digit < 0) {
                digit += BigInteger_base;
            } else {
                diff[i++] = digit;
                break;
            }
            diff[i] = digit;
        }
        for (; i < al; i++) {
            diff[i] = a[i];
        }

        return new BigInteger(diff, sign, CONSTRUCT);
    };

    (function () {
        function addOne(n, sign) {
            var a = n._d;
            var sum = a.slice();
            var carry = true;
            var i = 0;

            while (true) {
                var digit = (a[i] || 0) + 1;
                sum[i] = digit % BigInteger_base;
                if (digit <= BigInteger_base - 1) {
                    break;
                }
                ++i;
            }

            return new BigInteger(sum, sign, CONSTRUCT);
        }

        function subtractOne(n, sign) {
            var a = n._d;
            var sum = a.slice();
            var borrow = true;
            var i = 0;

            while (true) {
                var digit = (a[i] || 0) - 1;
                if (digit < 0) {
                    sum[i] = digit + BigInteger_base;
                } else {
                    sum[i] = digit;
                    break;
                }
                ++i;
            }

            return new BigInteger(sum, sign, CONSTRUCT);
        }

        /*
         Function: next
         Get the next <BigInteger> (add one).

         Returns:

         *this* + 1.

         See Also:

         <add>, <prev>
         */
        BigInteger.prototype.next = function () {
            switch (this._s) {
            case 0:
                return ONE;
            case -1:
                return subtractOne(this, -1);
                // case 1:
            default:
                return addOne(this, 1);
            }
        };

        /*
         Function: prev
         Get the previous <BigInteger> (subtract one).

         Returns:

         *this* - 1.

         See Also:

         <next>, <subtract>
         */
        BigInteger.prototype.prev = function () {
            switch (this._s) {
            case 0:
                return M_ONE;
            case -1:
                return addOne(this, -1);
                // case 1:
            default:
                return subtractOne(this, 1);
            }
        };
    })();

    /*
     Function: compareAbs
     Compare the absolute value of two <BigIntegers>.

     Calling <compareAbs> is faster than calling <abs> twice, then <compare>.

     Parameters:

     n - The number to compare to *this*. Will be converted to a <BigInteger>.

     Returns:

     -1, 0, or +1 if *|this|* is less than, equal to, or greater than *|n|*.

     See Also:

     <compare>, <abs>
     */
    BigInteger.prototype.compareAbs = function (n) {
        if (this === n) {
            return 0;
        }

        if (!(n instanceof BigInteger)) {
            if (!isFinite(n)) {
                return (isNaN(n) ? n : -1);
            }
            n = BigInteger(n);
        }

        if (this._s === 0) {
            return (n._s !== 0) ? -1 : 0;
        }
        if (n._s === 0) {
            return 1;
        }

        var l = this._d.length;
        var nl = n._d.length;
        if (l < nl) {
            return -1;
        } else if (l > nl) {
            return 1;
        }

        var a = this._d;
        var b = n._d;
        for (var i = l - 1; i >= 0; i--) {
            if (a[i] !== b[i]) {
                return a[i] < b[i] ? -1 : 1;
            }
        }

        return 0;
    };

    /*
     Function: compare
     Compare two <BigIntegers>.

     Parameters:

     n - The number to compare to *this*. Will be converted to a <BigInteger>.

     Returns:

     -1, 0, or +1 if *this* is less than, equal to, or greater than *n*.

     See Also:

     <compareAbs>, <isPositive>, <isNegative>, <isUnit>
     */
    BigInteger.prototype.compare = function (n) {
        if (this === n) {
            return 0;
        }

        n = BigInteger(n);

        if (this._s === 0) {
            return -n._s;
        }

        if (this._s === n._s) { // both positive or both negative
            var cmp = this.compareAbs(n);
            return cmp * this._s;
        } else {
            return this._s;
        }
    };

    /*
     Function: isUnit
     Return true iff *this* is either 1 or -1.

     Returns:

     true if *this* compares equal to <BigInteger.ONE> or <BigInteger.M_ONE>.

     See Also:

     <isZero>, <isNegative>, <isPositive>, <compareAbs>, <compare>,
     <BigInteger.ONE>, <BigInteger.M_ONE>
     */
    BigInteger.prototype.isUnit = function () {
        return this === ONE ||
            this === M_ONE ||
            (this._d.length === 1 && this._d[0] === 1);
    };

    /*
     Function: multiply
     Multiply two <BigIntegers>.

     Parameters:

     n - The number to multiply *this* by. Will be converted to a
     <BigInteger>.

     Returns:

     The numbers multiplied together.

     See Also:

     <add>, <subtract>, <quotient>, <square>
     */
    BigInteger.prototype.multiply = function (n) {
        // TODO: Consider adding Karatsuba multiplication for large numbers
        if (this._s === 0) {
            return ZERO;
        }

        n = BigInteger(n);
        if (n._s === 0) {
            return ZERO;
        }
        if (this.isUnit()) {
            if (this._s < 0) {
                return n.negate();
            }
            return n;
        }
        if (n.isUnit()) {
            if (n._s < 0) {
                return this.negate();
            }
            return this;
        }
        if (this === n) {
            return this.square();
        }

        var r = (this._d.length >= n._d.length);
        var a = (r ? this : n)._d; // a will be longer than b
        var b = (r ? n : this)._d;
        var al = a.length;
        var bl = b.length;

        var pl = al + bl;
        var partial = new Array(pl);
        var i;
        for (i = 0; i < pl; i++) {
            partial[i] = 0;
        }

        for (i = 0; i < bl; i++) {
            var carry = 0;
            var bi = b[i];
            var jlimit = al + i;
            var digit;
            for (var j = i; j < jlimit; j++) {
                digit = partial[j] + bi * a[j - i] + carry;
                carry = (digit / BigInteger_base) | 0;
                partial[j] = (digit % BigInteger_base) | 0;
            }
            if (carry) {
                digit = partial[j] + carry;
                carry = (digit / BigInteger_base) | 0;
                partial[j] = digit % BigInteger_base;
            }
        }
        return new BigInteger(partial, this._s * n._s, CONSTRUCT);
    };

    // Multiply a BigInteger by a single-digit native number
    // Assumes that this and n are >= 0
    // This is not really intended to be used outside the library itself
    BigInteger.prototype.multiplySingleDigit = function (n) {
        if (n === 0 || this._s === 0) {
            return ZERO;
        }
        if (n === 1) {
            return this;
        }

        var digit;
        if (this._d.length === 1) {
            digit = this._d[0] * n;
            if (digit >= BigInteger_base) {
                return new BigInteger([(digit % BigInteger_base) | 0,
                    (digit / BigInteger_base) | 0], 1, CONSTRUCT);
            }
            return new BigInteger([digit], 1, CONSTRUCT);
        }

        if (n === 2) {
            return this.add(this);
        }
        if (this.isUnit()) {
            return new BigInteger([n], 1, CONSTRUCT);
        }

        var a = this._d;
        var al = a.length;

        var pl = al + 1;
        var partial = new Array(pl);
        for (var i = 0; i < pl; i++) {
            partial[i] = 0;
        }

        var carry = 0;
        for (var j = 0; j < al; j++) {
            digit = n * a[j] + carry;
            carry = (digit / BigInteger_base) | 0;
            partial[j] = (digit % BigInteger_base) | 0;
        }
        if (carry) {
            partial[j] = carry;
        }

        return new BigInteger(partial, 1, CONSTRUCT);
    };

    /*
     Function: square
     Multiply a <BigInteger> by itself.

     This is slightly faster than regular multiplication, since it removes the
     duplicated multiplcations.

     Returns:

     > this.multiply(this)

     See Also:
     <multiply>
     */
    BigInteger.prototype.square = function () {
        // Normally, squaring a 10-digit number would take 100 multiplications.
        // Of these 10 are unique diagonals, of the remaining 90 (100-10), 45 are repeated.
        // This procedure saves (N*(N-1))/2 multiplications, (e.g., 45 of 100 multiplies).
        // Based on code by Gary Darby, Intellitech Systems Inc., www.DelphiForFun.org

        if (this._s === 0) {
            return ZERO;
        }
        if (this.isUnit()) {
            return ONE;
        }

        var digits = this._d;
        var length = digits.length;
        var imult1 = new Array(length + length + 1);
        var product, carry, k;
        var i;

        // Calculate diagonal
        for (i = 0; i < length; i++) {
            k = i * 2;
            product = digits[i] * digits[i];
            carry = (product / BigInteger_base) | 0;
            imult1[k] = product % BigInteger_base;
            imult1[k + 1] = carry;
        }

        // Calculate repeating part
        for (i = 0; i < length; i++) {
            carry = 0;
            k = i * 2 + 1;
            for (var j = i + 1; j < length; j++, k++) {
                product = digits[j] * digits[i] * 2 + imult1[k] + carry;
                carry = (product / BigInteger_base) | 0;
                imult1[k] = product % BigInteger_base;
            }
            k = length + i;
            var digit = carry + imult1[k];
            carry = (digit / BigInteger_base) | 0;
            imult1[k] = digit % BigInteger_base;
            imult1[k + 1] += carry;
        }

        return new BigInteger(imult1, 1, CONSTRUCT);
    };

    /*
     Function: quotient
     Divide two <BigIntegers> and truncate towards zero.

     <quotient> throws an exception if *n* is zero.

     Parameters:

     n - The number to divide *this* by. Will be converted to a <BigInteger>.

     Returns:

     The *this* / *n*, truncated to an integer.

     See Also:

     <add>, <subtract>, <multiply>, <divRem>, <remainder>
     */
    BigInteger.prototype.quotient = function (n) {
        return this.divRem(n)[0];
    };

    /*
     Function: divide
     Deprecated synonym for <quotient>.
     */
    BigInteger.prototype.divide = BigInteger.prototype.quotient;

    /*
     Function: remainder
     Calculate the remainder of two <BigIntegers>.

     <remainder> throws an exception if *n* is zero.

     Parameters:

     n - The remainder after *this* is divided *this* by *n*. Will be
     converted to a <BigInteger>.

     Returns:

     *this* % *n*.

     See Also:

     <divRem>, <quotient>
     */
    BigInteger.prototype.remainder = function (n) {
        return this.divRem(n)[1];
    };

    /*
     Function: divRem
     Calculate the integer quotient and remainder of two <BigIntegers>.

     <divRem> throws an exception if *n* is zero.

     Parameters:

     n - The number to divide *this* by. Will be converted to a <BigInteger>.

     Returns:

     A two-element array containing the quotient and the remainder.

     > a.divRem(b)

     is exactly equivalent to

     > [a.quotient(b), a.remainder(b)]

     except it is faster, because they are calculated at the same time.

     See Also:

     <quotient>, <remainder>
     */
    BigInteger.prototype.divRem = function (n) {
        n = BigInteger(n);
        if (n._s === 0) {
            throw new Error("Divide by zero");
        }
        if (this._s === 0) {
            return [ZERO, ZERO];
        }
        if (n._d.length === 1) {
            return this.divRemSmall(n._s * n._d[0]);
        }

        // Test for easy cases -- |n1| <= |n2|
        switch (this.compareAbs(n)) {
        case 0: // n1 == n2
            return [this._s === n._s ? ONE : M_ONE, ZERO];
        case -1: // |n1| < |n2|
            return [ZERO, this];
        }

        var sign = this._s * n._s;
        var a = n.abs();
        var b_digits = this._d;
        var b_index = b_digits.length;
        var digits = n._d.length;
        var quot = [];
        var guess;

        var part = new BigInteger([], 0, CONSTRUCT);
        part._s = 1;

        while (b_index) {
            part._d.unshift(b_digits[--b_index]);

            if (part.compareAbs(n) < 0) {
                quot.push(0);
                continue;
            }
            if (part._s === 0) {
                guess = 0;
            } else {
                var xlen = part._d.length,
                    ylen = a._d.length;
                var highx = part._d[xlen - 1] * BigInteger_base + part._d[xlen - 2];
                var highy = a._d[ylen - 1] * BigInteger_base + a._d[ylen - 2];
                if (part._d.length > a._d.length) {
                    // The length of part._d can either match a._d length,
                    // or exceed it by one.
                    highx = (highx + 1) * BigInteger_base;
                }
                guess = Math.ceil(highx / highy);
            }
            do {
                var check = a.multiplySingleDigit(guess);
                if (check.compareAbs(part) <= 0) {
                    break;
                }
                guess--;
            } while (guess);

            quot.push(guess);
            if (!guess) {
                continue;
            }
            var diff = part.subtract(check);
            part._d = diff._d.slice();
            if (part._d.length === 0) {
                part._s = 0;
            }
        }

        return [new BigInteger(quot.reverse(), sign, CONSTRUCT),
            new BigInteger(part._d, this._s, CONSTRUCT)];
    };

    // Throws an exception if n is outside of (-BigInteger.base, -1] or
    // [1, BigInteger.base).  It's not necessary to call this, since the
    // other division functions will call it if they are able to.
    BigInteger.prototype.divRemSmall = function (n) {
        var r;
        n = +n;
        if (n === 0) {
            throw new Error("Divide by zero");
        }

        var n_s = n < 0 ? -1 : 1;
        var sign = this._s * n_s;
        n = Math.abs(n);

        if (n < 1 || n >= BigInteger_base) {
            throw new Error("Argument out of range");
        }

        if (this._s === 0) {
            return [ZERO, ZERO];
        }

        if (n === 1 || n === -1) {
            return [(sign === 1) ? this.abs() : new BigInteger(this._d, sign, CONSTRUCT), ZERO];
        }

        // 2 <= n < BigInteger_base

        // divide a single digit by a single digit
        if (this._d.length === 1) {
            var q = new BigInteger([(this._d[0] / n) | 0], 1, CONSTRUCT);
            r = new BigInteger([(this._d[0] % n) | 0], 1, CONSTRUCT);
            if (sign < 0) {
                q = q.negate();
            }
            if (this._s < 0) {
                r = r.negate();
            }
            return [q, r];
        }

        var digits = this._d.slice();
        var quot = new Array(digits.length);
        var part = 0;
        var diff = 0;
        var i = 0;
        var guess;

        while (digits.length) {
            part = part * BigInteger_base + digits[digits.length - 1];
            if (part < n) {
                quot[i++] = 0;
                digits.pop();
                diff = BigInteger_base * diff + part;
                continue;
            }
            if (part === 0) {
                guess = 0;
            } else {
                guess = (part / n) | 0;
            }

            var check = n * guess;
            diff = part - check;
            quot[i++] = guess;
            if (!guess) {
                digits.pop();
                continue;
            }

            digits.pop();
            part = diff;
        }

        r = new BigInteger([diff], 1, CONSTRUCT);
        if (this._s < 0) {
            r = r.negate();
        }
        return [new BigInteger(quot.reverse(), sign, CONSTRUCT), r];
    };

    /*
     Function: isEven
     Return true iff *this* is divisible by two.

     Note that <BigInteger.ZERO> is even.

     Returns:

     true if *this* is even, false otherwise.

     See Also:

     <isOdd>
     */
    BigInteger.prototype.isEven = function () {
        var digits = this._d;
        return this._s === 0 || digits.length === 0 || (digits[0] % 2) === 0;
    };

    /*
     Function: isOdd
     Return true iff *this* is not divisible by two.

     Returns:

     true if *this* is odd, false otherwise.

     See Also:

     <isEven>
     */
    BigInteger.prototype.isOdd = function () {
        return !this.isEven();
    };

    /*
     Function: sign
     Get the sign of a <BigInteger>.

     Returns:

     * -1 if *this* < 0
     * 0 if *this* == 0
     * +1 if *this* > 0

     See Also:

     <isZero>, <isPositive>, <isNegative>, <compare>, <BigInteger.ZERO>
     */
    BigInteger.prototype.sign = function () {
        return this._s;
    };

    /*
     Function: isPositive
     Return true iff *this* > 0.

     Returns:

     true if *this*.compare(<BigInteger.ZERO>) == 1.

     See Also:

     <sign>, <isZero>, <isNegative>, <isUnit>, <compare>, <BigInteger.ZERO>
     */
    BigInteger.prototype.isPositive = function () {
        return this._s > 0;
    };

    /*
     Function: isNegative
     Return true iff *this* < 0.

     Returns:

     true if *this*.compare(<BigInteger.ZERO>) == -1.

     See Also:

     <sign>, <isPositive>, <isZero>, <isUnit>, <compare>, <BigInteger.ZERO>
     */
    BigInteger.prototype.isNegative = function () {
        return this._s < 0;
    };

    /*
     Function: isZero
     Return true iff *this* == 0.

     Returns:

     true if *this*.compare(<BigInteger.ZERO>) == 0.

     See Also:

     <sign>, <isPositive>, <isNegative>, <isUnit>, <BigInteger.ZERO>
     */
    BigInteger.prototype.isZero = function () {
        return this._s === 0;
    };

    /*
     Function: exp10
     Multiply a <BigInteger> by a power of 10.

     This is equivalent to, but faster than

     > if (n >= 0) {
     >     return this.multiply(BigInteger("1e" + n));
     > }
     > else { // n <= 0
     >     return this.quotient(BigInteger("1e" + -n));
     > }

     Parameters:

     n - The power of 10 to multiply *this* by. *n* is converted to a
     javascipt number and must be no greater than <BigInteger.MAX_EXP>
     (0x7FFFFFFF), or an exception will be thrown.

     Returns:

     *this* * (10 ** *n*), truncated to an integer if necessary.

     See Also:

     <pow>, <multiply>
     */
    BigInteger.prototype.exp10 = function (n) {
        n = +n;
        if (n === 0) {
            return this;
        }
        if (Math.abs(n) > Number(MAX_EXP)) {
            throw new Error("exponent too large in BigInteger.exp10");
        }
        if (n > 0) {
            var k = new BigInteger(this._d.slice(), this._s, CONSTRUCT);

            for (; n >= BigInteger_base_log10; n -= BigInteger_base_log10) {
                k._d.unshift(0);
            }
            if (n == 0)
                return k;
            k._s = 1;
            k = k.multiplySingleDigit(Math.pow(10, n));
            return (this._s < 0 ? k.negate() : k);
        } else if (-n >= this._d.length * BigInteger_base_log10) {
            return ZERO;
        } else {
            var k = new BigInteger(this._d.slice(), this._s, CONSTRUCT);

            for (n = -n; n >= BigInteger_base_log10; n -= BigInteger_base_log10) {
                k._d.shift();
            }
            return (n == 0) ? k : k.divRemSmall(Math.pow(10, n))[0];
        }
    };

    /*
     Function: pow
     Raise a <BigInteger> to a power.

     In this implementation, 0**0 is 1.

     Parameters:

     n - The exponent to raise *this* by. *n* must be no greater than
     <BigInteger.MAX_EXP> (0x7FFFFFFF), or an exception will be thrown.

     Returns:

     *this* raised to the *nth* power.

     See Also:

     <modPow>
     */
    BigInteger.prototype.pow = function (n) {
        if (this.isUnit()) {
            if (this._s > 0) {
                return this;
            } else {
                return BigInteger(n).isOdd() ? this : this.negate();
            }
        }

        n = BigInteger(n);
        if (n._s === 0) {
            return ONE;
        } else if (n._s < 0) {
            if (this._s === 0) {
                throw new Error("Divide by zero");
            } else {
                return ZERO;
            }
        }
        if (this._s === 0) {
            return ZERO;
        }
        if (n.isUnit()) {
            return this;
        }

        if (n.compareAbs(MAX_EXP) > 0) {
            throw new Error("exponent too large in BigInteger.pow");
        }
        var x = this;
        var aux = ONE;
        var two = BigInteger.small[2];

        while (n.isPositive()) {
            if (n.isOdd()) {
                aux = aux.multiply(x);
                if (n.isUnit()) {
                    return aux;
                }
            }
            x = x.square();
            n = n.quotient(two);
        }

        return aux;
    };

    /*
     Function: modPow
     Raise a <BigInteger> to a power (mod m).

     Because it is reduced by a modulus, <modPow> is not limited by
     <BigInteger.MAX_EXP> like <pow>.

     Parameters:

     exponent - The exponent to raise *this* by. Must be positive.
     modulus - The modulus.

     Returns:

     *this* ^ *exponent* (mod *modulus*).

     See Also:

     <pow>, <mod>
     */
    BigInteger.prototype.modPow = function (exponent, modulus) {
        var result = ONE;
        var base = this;

        while (exponent.isPositive()) {
            if (exponent.isOdd()) {
                result = result.multiply(base).remainder(modulus);
            }

            exponent = exponent.quotient(BigInteger.small[2]);
            if (exponent.isPositive()) {
                base = base.square().remainder(modulus);
            }
        }

        return result;
    };

    /*
     Function: log
     Get the natural logarithm of a <BigInteger> as a native JavaScript number.

     This is equivalent to

     > Math.log(this.toJSValue())

     but handles values outside of the native number range.

     Returns:

     log( *this* )

     See Also:

     <toJSValue>
     */
    BigInteger.prototype.log = function () {
        switch (this._s) {
        case 0:
            return -Infinity;
        case -1:
            return NaN;
        default: // Fall through.
        }

        var l = this._d.length;

        if (l * BigInteger_base_log10 < 30) {
            return Math.log(this.valueOf());
        }

        var N = Math.ceil(30 / BigInteger_base_log10);
        var firstNdigits = this._d.slice(l - N);
        return Math.log((new BigInteger(firstNdigits, 1, CONSTRUCT)).valueOf()) + (l - N) * Math.log(BigInteger_base);
    };

    /*
     Function: valueOf
     Convert a <BigInteger> to a native JavaScript integer.

     This is called automatically by JavaScipt to convert a <BigInteger> to a
     native value.

     Returns:

     > parseInt(this.toString(), 10)

     See Also:

     <toString>, <toJSValue>
     */
    BigInteger.prototype.valueOf = function () {
        return parseInt(this.toString(), 10);
    };

    /*
     Function: toJSValue
     Convert a <BigInteger> to a native JavaScript integer.

     This is the same as valueOf, but more explicitly named.

     Returns:

     > parseInt(this.toString(), 10)

     See Also:

     <toString>, <valueOf>
     */
    BigInteger.prototype.toJSValue = function () {
        return parseInt(this.toString(), 10);
    };


    /*
    Function: lowVal
    Author: Lucas Jones
    */
    BigInteger.prototype.lowVal = function () {
        return this._d[0] || 0;
    };

    var MAX_EXP = BigInteger(0x7FFFFFFF);
    // Constant: MAX_EXP
    // The largest exponent allowed in <pow> and <exp10> (0x7FFFFFFF or 2147483647).
    BigInteger.MAX_EXP = MAX_EXP;

    (function () {
        function makeUnary(fn) {
            return function (a) {
                return fn.call(BigInteger(a));
            };
        }

        function makeBinary(fn) {
            return function (a, b) {
                return fn.call(BigInteger(a), BigInteger(b));
            };
        }

        function makeTrinary(fn) {
            return function (a, b, c) {
                return fn.call(BigInteger(a), BigInteger(b), BigInteger(c));
            };
        }

        (function () {
            var i, fn;
            var unary = "toJSValue,isEven,isOdd,sign,isZero,isNegative,abs,isUnit,square,negate,isPositive,toString,next,prev,log".split(",");
            var binary = "compare,remainder,divRem,subtract,add,quotient,divide,multiply,pow,compareAbs".split(",");
            var trinary = ["modPow"];

            for (i = 0; i < unary.length; i++) {
                fn = unary[i];
                BigInteger[fn] = makeUnary(BigInteger.prototype[fn]);
            }

            for (i = 0; i < binary.length; i++) {
                fn = binary[i];
                BigInteger[fn] = makeBinary(BigInteger.prototype[fn]);
            }

            for (i = 0; i < trinary.length; i++) {
                fn = trinary[i];
                BigInteger[fn] = makeTrinary(BigInteger.prototype[fn]);
            }

            BigInteger.exp10 = function (x, n) {
                return BigInteger(x).exp10(n);
            };
        })();
    })();

    return BigInteger;
})();
var cnBase58 = (function () {
    var b58 = {};

    var alphabet_str = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    var alphabet = [];
    for (var i = 0; i < alphabet_str.length; i++) {
        alphabet.push(alphabet_str.charCodeAt(i));
    }
    var encoded_block_sizes = [0, 2, 3, 5, 6, 7, 9, 10, 11];

    var alphabet_size = alphabet.length;
    var full_block_size = 8;
    var full_encoded_block_size = 11;

    var UINT64_MAX = new JSBigInt(2).pow(64);

    function hextobin(hex) {
        if (hex.length % 2 !== 0) throw "Hex string has invalid length!";
        var res = new Uint8Array(hex.length / 2);
        for (var i = 0; i < hex.length / 2; ++i) {
            res[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        }
        return res;
    }
    this.hextobin = hextobin;
    b58.hextobin = hextobin;

    function bintohex(bin) {
        var out = [];
        for (var i = 0; i < bin.length; ++i) {
            out.push(("0" + bin[i].toString(16)).slice(-2));
        }
        return out.join("");
    }
    this.bintohex = bintohex;
    b58.bintohex = bintohex;

    function strtobin(str) {
        var res = new Uint8Array(str.length);
        for (var i = 0; i < str.length; i++) {
            res[i] = str.charCodeAt(i);
        }
        return res;
    }
    this.strtobin = strtobin;
    b58.strtobin = strtobin;

    function bintostr(bin) {
        var out = [];
        for (var i = 0; i < bin.length; i++) {
            out.push(String.fromCharCode(bin[i]));
        }
        return out.join("");
    }

    function uint8_be_to_64(data) {
        if (data.length < 1 || data.length > 8) {
            throw "Invalid input length";
        }
        var res = JSBigInt.ZERO;
        var twopow8 = new JSBigInt(2).pow(8);
        var i = 0;
        switch (9 - data.length) {
        case 1:
            res = res.add(data[i++]);
        case 2:
            res = res.multiply(twopow8).add(data[i++]);
        case 3:
            res = res.multiply(twopow8).add(data[i++]);
        case 4:
            res = res.multiply(twopow8).add(data[i++]);
        case 5:
            res = res.multiply(twopow8).add(data[i++]);
        case 6:
            res = res.multiply(twopow8).add(data[i++]);
        case 7:
            res = res.multiply(twopow8).add(data[i++]);
        case 8:
            res = res.multiply(twopow8).add(data[i++]);
            break;
        default:
            throw "Impossible condition";
        }
        return res;
    }

    function uint64_to_8be(num, size) {
        var res = new Uint8Array(size);
        if (size < 1 || size > 8) {
            throw "Invalid input length";
        }
        var twopow8 = new JSBigInt(2).pow(8);
        for (var i = size - 1; i >= 0; i--) {
            res[i] = num.remainder(twopow8).toJSValue();
            num = num.divide(twopow8);
        }
        return res;
    }

    b58.encode_block = function (data, buf, index) {
        if (data.length < 1 || data.length > full_encoded_block_size) {
            throw "Invalid block length: " + data.length;
        }
        var num = uint8_be_to_64(data);
        var i = encoded_block_sizes[data.length] - 1;
        // while num > 0
        while (num.compare(0) === 1) {
            var div = num.divRem(alphabet_size);
            // remainder = num % alphabet_size
            var remainder = div[1];
            // num = num / alphabet_size
            num = div[0];
            buf[index + i] = alphabet[remainder.toJSValue()];
            i--;
        }
        return buf;
    };

    b58.encode = function (hex) {
        var data = hextobin(hex);
        if (data.length === 0) {
            return "";
        }
        var full_block_count = Math.floor(data.length / full_block_size);
        var last_block_size = data.length % full_block_size;
        var res_size = full_block_count * full_encoded_block_size + encoded_block_sizes[last_block_size];

        var res = new Uint8Array(res_size);
        var i;
        for (i = 0; i < res_size; ++i) {
            res[i] = alphabet[0];
        }
        for (i = 0; i < full_block_count; i++) {
            res = b58.encode_block(data.subarray(i * full_block_size, i * full_block_size + full_block_size), res, i * full_encoded_block_size);
        }
        if (last_block_size > 0) {
            res = b58.encode_block(data.subarray(full_block_count * full_block_size, full_block_count * full_block_size + last_block_size), res, full_block_count * full_encoded_block_size)
        }
        return bintostr(res);
    };

    b58.decode_block = function (data, buf, index) {
        if (data.length < 1 || data.length > full_encoded_block_size) {
            throw "Invalid block length: " + data.length;
        }

        var res_size = encoded_block_sizes.indexOf(data.length);
        if (res_size <= 0) {
            throw "Invalid block size";
        }
        var res_num = new JSBigInt(0);
        var order = new JSBigInt(1);
        for (var i = data.length - 1; i >= 0; i--) {
            var digit = alphabet.indexOf(data[i]);
            if (digit < 0) {
                throw "Invalid symbol";
            }
            var product = order.multiply(digit).add(res_num);
            // if product > UINT64_MAX
            if (product.compare(UINT64_MAX) === 1) {
                throw "Overflow";
            }
            res_num = product;
            order = order.multiply(alphabet_size);
        }
        if (res_size < full_block_size && (new JSBigInt(2).pow(8 * res_size).compare(res_num) <= 0)) {
            throw "Overflow 2";
        }
        buf.set(uint64_to_8be(res_num, res_size), index);
        return buf;
    };

    b58.decode = function (enc) {
        enc = strtobin(enc);
        if (enc.length === 0) {
            return "";
        }
        var full_block_count = Math.floor(enc.length / full_encoded_block_size);
        var last_block_size = enc.length % full_encoded_block_size;
        var last_block_decoded_size = encoded_block_sizes.indexOf(last_block_size);
        if (last_block_decoded_size < 0) {
            throw "Invalid encoded length";
        }
        var data_size = full_block_count * full_block_size + last_block_decoded_size;
        var data = new Uint8Array(data_size);
        for (var i = 0; i < full_block_count; i++) {
            data = b58.decode_block(enc.subarray(i * full_encoded_block_size, i * full_encoded_block_size + full_encoded_block_size), data, i * full_block_size);
        }
        if (last_block_size > 0) {
            data = b58.decode_block(enc.subarray(full_block_count * full_encoded_block_size, full_block_count * full_encoded_block_size + last_block_size), data, full_block_count * full_block_size);
        }
        return bintohex(data);
    };

    return b58;
})();
var crc32 = (function () {
    'use strict';
    var crc32 = {};

    crc32.Utf8Encode = function (string) {
        return unescape(encodeURIComponent(string));
    };

    crc32.run = function (str) {
        var crc = new crc32.Type();
        crc.processString(str);
        return crc.checksum();
    };

    crc32.table = [
        0, 1996959894, 3993919788, 2567524794, 124634137, 1886057615, 3915621685, 2657392035,
        249268274, 2044508324, 3772115230, 2547177864, 162941995, 2125561021, 3887607047, 2428444049,
        498536548, 1789927666, 4089016648, 2227061214, 450548861, 1843258603, 4107580753, 2211677639,
        325883990, 1684777152, 4251122042, 2321926636, 335633487, 1661365465, 4195302755, 2366115317,
        997073096, 1281953886, 3579855332, 2724688242, 1006888145, 1258607687, 3524101629, 2768942443,
        901097722, 1119000684, 3686517206, 2898065728, 853044451, 1172266101, 3705015759, 2882616665,
        651767980, 1373503546, 3369554304, 3218104598, 565507253, 1454621731, 3485111705, 3099436303,
        671266974, 1594198024, 3322730930, 2970347812, 795835527, 1483230225, 3244367275, 3060149565,
        1994146192, 31158534, 2563907772, 4023717930, 1907459465, 112637215, 2680153253, 3904427059,
        2013776290, 251722036, 2517215374, 3775830040, 2137656763, 141376813, 2439277719, 3865271297,
        1802195444, 476864866, 2238001368, 4066508878, 1812370925, 453092731, 2181625025, 4111451223,
        1706088902, 314042704, 2344532202, 4240017532, 1658658271, 366619977, 2362670323, 4224994405,
        1303535960, 984961486, 2747007092, 3569037538, 1256170817, 1037604311, 2765210733, 3554079995,
        1131014506, 879679996, 2909243462, 3663771856, 1141124467, 855842277, 2852801631, 3708648649,
        1342533948, 654459306, 3188396048, 3373015174, 1466479909, 544179635, 3110523913, 3462522015,
        1591671054, 702138776, 2966460450, 3352799412, 1504918807, 783551873, 3082640443, 3233442989,
        3988292384, 2596254646, 62317068, 1957810842, 3939845945, 2647816111, 81470997, 1943803523,
        3814918930, 2489596804, 225274430, 2053790376, 3826175755, 2466906013, 167816743, 2097651377,
        4027552580, 2265490386, 503444072, 1762050814, 4150417245, 2154129355, 426522225, 1852507879,
        4275313526, 2312317920, 282753626, 1742555852, 4189708143, 2394877945, 397917763, 1622183637,
        3604390888, 2714866558, 953729732, 1340076626, 3518719985, 2797360999, 1068828381, 1219638859,
        3624741850, 2936675148, 906185462, 1090812512, 3747672003, 2825379669, 829329135, 1181335161,
        3412177804, 3160834842, 628085408, 1382605366, 3423369109, 3138078467, 570562233, 1426400815,
        3317316542, 2998733608, 733239954, 1555261956, 3268935591, 3050360625, 752459403, 1541320221,
        2607071920, 3965973030, 1969922972, 40735498, 2617837225, 3943577151, 1913087877, 83908371,
        2512341634, 3803740692, 2075208622, 213261112, 2463272603, 3855990285, 2094854071, 198958881,
        2262029012, 4057260610, 1759359992, 534414190, 2176718541, 4139329115, 1873836001, 414664567,
        2282248934, 4279200368, 1711684554, 285281116, 2405801727, 4167216745, 1634467795, 376229701,
        2685067896, 3608007406, 1308918612, 956543938, 2808555105, 3495958263, 1231636301, 1047427035,
        2932959818, 3654703836, 1088359270, 936918000, 2847714899, 3736837829, 1202900863, 817233897,
        3183342108, 3401237130, 1404277552, 615818150, 3134207493, 3453421203, 1423857449, 601450431,
        3009837614, 3294710456, 1567103746, 711928724, 3020668471, 3272380065, 1510334235, 755167117
    ];
    crc32.Type = function () {
        this.rem_ = 0xFFFFFFFF;
        this.checksum = function () {
            return ((this.rem_ ^ 0xFFFFFFFF) >>> 0);
        };
        this.processString = function (str) {
            str = crc32.Utf8Encode(str);
            for (var i = 0; i < str.length; i++) {
                var byte_index = ((str.charCodeAt(i) ^ this.rem_) >>> 0) & 0xFF;
                this.rem_ = ((this.rem_ >>> 8) ^ crc32.table[byte_index]) >>> 0;
            }
        };
        return this;
    };

    return crc32;
})();

function mn_random(bits) {
    'use strict';
    if (bits % 32 !== 0) throw "Something weird went wrong: Invalid number of bits - " + bits;
    var array = new Uint32Array(bits / 32);
    if (!window.crypto) throw "Unfortunately this programm only runs on browsers that support the JavaScript Crypto API";
    var i = 0;

    function arr_is_zero() {
        for (var j = 0; j < bits / 32; ++j) {
            if (array[j] !== 0) return false;
        }
        return true;
    }

    do {
        window.crypto.getRandomValues(array);
        ++i;
    } while (i < 5 && arr_is_zero());
    if (arr_is_zero()) {
        throw "Something went wrong and we could not securely generate random data for your account";
    }
    // Convert to hex
    var out = '';
    for (var j = 0; j < bits / 32; ++j) {
        out += ('0000000' + array[j].toString(16)).slice(-8);
    }
    return out;
};
