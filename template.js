/**
*  提供一个字符串格式化模块,支持四则运算,三元运算符,一元运算
*  by xuwenmin
* if 里可以无限嵌套if ，目前不支持else if,支持包含each
* for 里可以嵌套一级if,不支持嵌套each
*/
;(function(root){
	var _        = {},
		slice    = Array.prototype.slice,
		concat   = Array.prototype.concat,
		regModel = /\{\{(.+?)\}\}/g,
		noop = function(){};
	var regIfStart = /<%\s*if\s*\((.+?)\)\s*{\s*%>/g;
	var regIfEnd = /<%\s*}\s*%>/g;
	var regor = /(<%\s*((if)|(for))\s*\((.+?)\)\s*\{\s*%>)|(<%\s*}\s*%>)/g;
	var regfor = /\s*(.+)\s*in\s*(.+)\s*/g;
	var regnative = /([\?\:\+\*\/\.\(\)\{\}\|]{1})/g;

	/**
	* 提供字符串词法分析与语法分析
	* 
	*
	*/
	(function(root){
			// 字符串解析核心函数----------start----------
			var noop = function(){};
			var extend = function(src, dist){
				for(var k in dist){
					src[k] = dist[k];
				}
				return src;
			}
			var isDefined = function(obj){
				return typeof obj == 'undefined' ? false : true;
			};
			var lowercase = function(char){
				return char.toLowerCase();
			}
			// 构建解析自定义异常函数
			var $parseMinErr = function(){
				var result = [];
				result.push(arguments[0] + '\r\n');
				var error_format = arguments[1];
				var vals = slice.call(arguments, 0).slice(2);
				var source = {};
				error_format.replace(/\{(\d+)\}/g, function($0, $1){
					source[$0] = vals[+$1].toString();
				});
				for(var k in source){
					error_format = error_format.replace(k, source[k]);
				}
				result.push(error_format);
				return new Error(result.join(''));
			}
			function ensureSafeMemberName(name, fullExpression) {
			  if (name === "constructor") {
			    throw $parseMinErr('isecfld',
			        'Referencing "constructor" field in Angular expressions is disallowed! Expression: {0}',
			        fullExpression);
			  }
			  return name;
			}

			function ensureSafeObject(obj, fullExpression) {
			  // nifty check if obj is Function that is fast and works across iframes and other contexts
			  if (obj) {
			    if (obj.constructor === obj) {
			      throw $parseMinErr('isecfn',
			          'Referencing Function in Angular expressions is disallowed! Expression: {0}',
			          fullExpression);
			    } else if (// isWindow(obj)
			        obj.document && obj.location && obj.alert && obj.setInterval) {
			      throw $parseMinErr('isecwindow',
			          'Referencing the Window in Angular expressions is disallowed! Expression: {0}',
			          fullExpression);
			    } else if (// isElement(obj)
			        obj.children && (obj.nodeName || (obj.on && obj.find))) {
			      throw $parseMinErr('isecdom',
			          'Referencing DOM nodes in Angular expressions is disallowed! Expression: {0}',
			          fullExpression);
			    }
			  }
			  return obj;
			}

			var OPERATORS = {
			    /* jshint bitwise : false */
			    'null':function(){return null;},
			    'true':function(){return true;},
			    'false':function(){return false;},
			    undefined:noop,
			    '+':function(self, locals, a,b){
			      a=a(self, locals); b=b(self, locals);
			      if (isDefined(a)) {
			        if (isDefined(b)) {
			          return a + b;
			        }
			        return a;
			      }
			      return isDefined(b)?b:undefined;},
			    '-':function(self, locals, a,b){
			          a=a(self, locals); b=b(self, locals);
			          return (isDefined(a)?a:0)-(isDefined(b)?b:0);
			        },
			    '*':function(self, locals, a,b){return a(self, locals)*b(self, locals);},
			    '/':function(self, locals, a,b){return a(self, locals)/b(self, locals);},
			    '%':function(self, locals, a,b){return a(self, locals)%b(self, locals);},
			    '^':function(self, locals, a,b){return a(self, locals)^b(self, locals);},
			    '=':noop,
			    '===':function(self, locals, a, b){return a(self, locals)===b(self, locals);},
			    '!==':function(self, locals, a, b){return a(self, locals)!==b(self, locals);},
			    '==':function(self, locals, a,b){return a(self, locals)==b(self, locals);},
			    '!=':function(self, locals, a,b){return a(self, locals)!=b(self, locals);},
			    '<':function(self, locals, a,b){return a(self, locals)<b(self, locals);},
			    '>':function(self, locals, a,b){return a(self, locals)>b(self, locals);},
			    '<=':function(self, locals, a,b){return a(self, locals)<=b(self, locals);},
			    '>=':function(self, locals, a,b){return a(self, locals)>=b(self, locals);},
			    '&&':function(self, locals, a,b){return a(self, locals)&&b(self, locals);},
			    '||':function(self, locals, a,b){return a(self, locals)||b(self, locals);},
			    '&':function(self, locals, a,b){return a(self, locals)&b(self, locals);},
				//    '|':function(self, locals, a,b){return a|b;},
			    '|':function(self, locals, a,b){return b(self, locals)(self, locals, a(self, locals));},
			    '!':function(self, locals, a){return !a(self, locals);}
			};
			/* jshint bitwise: true */
			var ESCAPE = {"n":"\n", "f":"\f", "r":"\r", "t":"\t", "v":"\v", "'":"'", '"':'"'};

			var Lexer = function (options) {
			  this.options = options;
			};

			Lexer.prototype = {
			  constructor: Lexer,

			  lex: function (text) {
			    this.text = text;

			    this.index = 0;
			    this.ch = undefined;
			    this.lastCh = ':'; // can start regexp

			    this.tokens = [];

			    var token;
			    var json = [];

			    while (this.index < this.text.length) {
			      this.ch = this.text.charAt(this.index);
			      if (this.is('"\'')) {
			        this.readString(this.ch);
			      } else if (this.isNumber(this.ch) || this.is('.') && this.isNumber(this.peek())) {
			        this.readNumber();
			      } else if (this.isIdent(this.ch)) {
			        this.readIdent();
			        // identifiers can only be if the preceding char was a { or ,
			        if (this.was('{,') && json[0] === '{' &&
			            (token = this.tokens[this.tokens.length - 1])) {
			          token.json = token.text.indexOf('.') === -1;
			        }
			      } else if (this.is('(){}[].,;:?')) {
			        this.tokens.push({
			          index: this.index,
			          text: this.ch,
			          json: (this.was(':[,') && this.is('{[')) || this.is('}]:,')
			        });
			        if (this.is('{[')) json.unshift(this.ch);
			        if (this.is('}]')) json.shift();
			        this.index++;
			      } else if (this.isWhitespace(this.ch)) {
			        this.index++;
			        continue;
			      } else {
			        var ch2 = this.ch + this.peek();
			        var ch3 = ch2 + this.peek(2);
			        var fn = OPERATORS[this.ch];
			        var fn2 = OPERATORS[ch2];
			        var fn3 = OPERATORS[ch3];
			        if (fn3) {
			          this.tokens.push({index: this.index, text: ch3, fn: fn3});
			          this.index += 3;
			        } else if (fn2) {
			          this.tokens.push({index: this.index, text: ch2, fn: fn2});
			          this.index += 2;
			        } else if (fn) {
			          this.tokens.push({
			            index: this.index,
			            text: this.ch,
			            fn: fn,
			            json: (this.was('[,:') && this.is('+-'))
			          });
			          this.index += 1;
			        } else {
			          this.throwError('Unexpected next character ', this.index, this.index + 1);
			        }
			      }
			      this.lastCh = this.ch;
			    }
			    return this.tokens;
			  },

			  is: function(chars) {
			    return chars.indexOf(this.ch) !== -1;
			  },

			  was: function(chars) {
			    return chars.indexOf(this.lastCh) !== -1;
			  },

			  peek: function(i) {
			    var num = i || 1;
			    return (this.index + num < this.text.length) ? this.text.charAt(this.index + num) : false;
			  },

			  isNumber: function(ch) {
			    return ('0' <= ch && ch <= '9');
			  },

			  isWhitespace: function(ch) {
			    // IE treats non-breaking space as \u00A0
			    return (ch === ' ' || ch === '\r' || ch === '\t' ||
			            ch === '\n' || ch === '\v' || ch === '\u00A0');
			  },

			  isIdent: function(ch) {
			    return ('a' <= ch && ch <= 'z' ||
			            'A' <= ch && ch <= 'Z' ||
			            '_' === ch || ch === '$');
			  },

			  isExpOperator: function(ch) {
			    return (ch === '-' || ch === '+' || this.isNumber(ch));
			  },

			  throwError: function(error, start, end) {
			    end = end || this.index;
			    var colStr = (isDefined(start)
			            ? 's ' + start +  '-' + this.index + ' [' + this.text.substring(start, end) + ']'
			            : ' ' + end);
			    throw $parseMinErr('lexerr', 'Lexer Error: {0} at column{1} in expression [{2}].',
			        error, colStr, this.text);
			  },

			  readNumber: function() {
			    var number = '';
			    var start = this.index;
			    while (this.index < this.text.length) {
			      var ch = lowercase(this.text.charAt(this.index));
			      if (ch == '.' || this.isNumber(ch)) {
			        number += ch;
			      } else {
			        var peekCh = this.peek();
			        if (ch == 'e' && this.isExpOperator(peekCh)) {
			          number += ch;
			        } else if (this.isExpOperator(ch) &&
			            peekCh && this.isNumber(peekCh) &&
			            number.charAt(number.length - 1) == 'e') {
			          number += ch;
			        } else if (this.isExpOperator(ch) &&
			            (!peekCh || !this.isNumber(peekCh)) &&
			            number.charAt(number.length - 1) == 'e') {
			          this.throwError('Invalid exponent');
			        } else {
			          break;
			        }
			      }
			      this.index++;
			    }
			    number = 1 * number;
			    this.tokens.push({
			      index: start,
			      text: number,
			      json: true,
			      fn: function() { return number; }
			    });
			  },

			  readIdent: function() {
			    var parser = this;

			    var ident = '';
			    var start = this.index;

			    var lastDot, peekIndex, methodName, ch;

			    while (this.index < this.text.length) {
			      ch = this.text.charAt(this.index);
			      if (ch === '.' || this.isIdent(ch) || this.isNumber(ch)) {
			        if (ch === '.') lastDot = this.index;
			        ident += ch;
			      } else {
			        break;
			      }
			      this.index++;
			    }

			    //check if this is not a method invocation and if it is back out to last dot
			    if (lastDot) {
			      peekIndex = this.index;
			      while (peekIndex < this.text.length) {
			        ch = this.text.charAt(peekIndex);
			        if (ch === '(') {
			          methodName = ident.substr(lastDot - start + 1);
			          ident = ident.substr(0, lastDot - start);
			          this.index = peekIndex;
			          break;
			        }
			        if (this.isWhitespace(ch)) {
			          peekIndex++;
			        } else {
			          break;
			        }
			      }
			    }


			    var token = {
			      index: start,
			      text: ident
			    };

			    // OPERATORS is our own object so we don't need to use special hasOwnPropertyFn
			    if (OPERATORS.hasOwnProperty(ident)) {
			      token.fn = OPERATORS[ident];
			      token.json = OPERATORS[ident];
			    } else {
			      var getter = getterFn(ident, this.options, this.text);
			      token.fn = extend(function(self, locals) {
			        return (getter(self, locals));
			      }, {
			        assign: function(self, value) {
			          return setter(self, ident, value, parser.text, parser.options);
			        }
			      });
			    }

			    this.tokens.push(token);

			    if (methodName) {
			      this.tokens.push({
			        index:lastDot,
			        text: '.',
			        json: false
			      });
			      this.tokens.push({
			        index: lastDot + 1,
			        text: methodName,
			        json: false
			      });
			    }
			  },

			  readString: function(quote) {
			    var start = this.index;
			    this.index++;
			    var string = '';
			    var rawString = quote;
			    var escape = false;
			    while (this.index < this.text.length) {
			      var ch = this.text.charAt(this.index);
			      rawString += ch;
			      if (escape) {
			        if (ch === 'u') {
			          var hex = this.text.substring(this.index + 1, this.index + 5);
			          if (!hex.match(/[\da-f]{4}/i))
			            this.throwError('Invalid unicode escape [\\u' + hex + ']');
			          this.index += 4;
			          string += String.fromCharCode(parseInt(hex, 16));
			        } else {
			          var rep = ESCAPE[ch];
			          if (rep) {
			            string += rep;
			          } else {
			            string += ch;
			          }
			        }
			        escape = false;
			      } else if (ch === '\\') {
			        escape = true;
			      } else if (ch === quote) {
			        this.index++;
			        this.tokens.push({
			          index: start,
			          text: rawString,
			          string: string,
			          json: true,
			          fn: function() { return string; }
			        });
			        return;
			      } else {
			        string += ch;
			      }
			      this.index++;
			    }
			    this.throwError('Unterminated quote', start);
			  }
			};


			/**
			 * @constructor
			 */
			var Parser = function (lexer, $filter, options) {
			  this.lexer = lexer;
			  this.$filter = $filter;
			  this.options = options;
			};

			Parser.ZERO = function () { return 0; };

			Parser.prototype = {
			  constructor: Parser,

			  parse: function (text, json) {
			    this.text = text;

			    //TODO(i): strip all the obsolte json stuff from this file
			    this.json = json;

			    this.tokens = this.lexer.lex(text);

			    if (json) {
			      // The extra level of aliasing is here, just in case the lexer misses something, so that
			      // we prevent any accidental execution in JSON.
			      this.assignment = this.logicalOR;

			      this.functionCall =
			      this.fieldAccess =
			      this.objectIndex =
			      this.filterChain = function() {
			        this.throwError('is not valid json', {text: text, index: 0});
			      };
			    }

			    var value = json ? this.primary() : this.statements();

			    if (this.tokens.length !== 0) {
			      this.throwError('is an unexpected token', this.tokens[0]);
			    }

			    value.literal = !!value.literal;
			    value.constant = !!value.constant;

			    return value;
			  },

			  primary: function () {
			    var primary;
			    if (this.expect('(')) {
			      primary = this.filterChain();
			      this.consume(')');
			    } else if (this.expect('[')) {
			      primary = this.arrayDeclaration();
			    } else if (this.expect('{')) {
			      primary = this.object();
			    } else {
			      var token = this.expect();
			      primary = token.fn;
			      if (!primary) {
			        this.throwError('not a primary expression', token);
			      }
			      if (token.json) {
			        primary.constant = true;
			        primary.literal = true;
			      }
			    }

			    var next, context;
			    while ((next = this.expect('(', '[', '.'))) {
			      if (next.text === '(') {
			        primary = this.functionCall(primary, context);
			        context = null;
			      } else if (next.text === '[') {
			        context = primary;
			        primary = this.objectIndex(primary);
			      } else if (next.text === '.') {
			        context = primary;
			        primary = this.fieldAccess(primary);
			      } else {
			        this.throwError('IMPOSSIBLE');
			      }
			    }
			    return primary;
			  },

			  throwError: function(msg, token) {
			    throw $parseMinErr('syntax',
			        'Syntax Error: Token \'{0}\' {1} at column {2} of the expression [{3}] starting at [{4}].',
			          token.text, msg, (token.index + 1), this.text, this.text.substring(token.index));
			  },

			  peekToken: function() {
			    if (this.tokens.length === 0)
			      throw $parseMinErr('ueoe', 'Unexpected end of expression: {0}', this.text);
			    return this.tokens[0];
			  },

			  peek: function(e1, e2, e3, e4) {
			    if (this.tokens.length > 0) {
			      var token = this.tokens[0];
			      var t = token.text;
			      if (t === e1 || t === e2 || t === e3 || t === e4 ||
			          (!e1 && !e2 && !e3 && !e4)) {
			        return token;
			      }
			    }
			    return false;
			  },

			  expect: function(e1, e2, e3, e4){
			    var token = this.peek(e1, e2, e3, e4);
			    if (token) {
			      if (this.json && !token.json) {
			        this.throwError('is not valid json', token);
			      }
			      this.tokens.shift();
			      return token;
			    }
			    return false;
			  },

			  consume: function(e1){
			    if (!this.expect(e1)) {
			      this.throwError('is unexpected, expecting [' + e1 + ']', this.peek());
			    }
			  },

			  unaryFn: function(fn, right) {
			    return extend(function(self, locals) {
			      return fn(self, locals, right);
			    }, {
			      constant:right.constant
			    });
			  },

			  ternaryFn: function(left, middle, right){
			    return extend(function(self, locals){
			      return left(self, locals) ? middle(self, locals) : right(self, locals);
			    }, {
			      constant: left.constant && middle.constant && right.constant
			    });
			  },

			  binaryFn: function(left, fn, right) {
			    return extend(function(self, locals) {
			      return fn(self, locals, left, right);
			    }, {
			      constant:left.constant && right.constant
			    });
			  },

			  statements: function() {
			    var statements = [];
			    while (true) {
			      if (this.tokens.length > 0 && !this.peek('}', ')', ';', ']'))
			        statements.push(this.filterChain());
			      if (!this.expect(';')) {
			        // optimize for the common case where there is only one statement.
			        // TODO(size): maybe we should not support multiple statements?
			        return (statements.length === 1)
			            ? statements[0]
			            : function(self, locals) {
			                var value;
			                for (var i = 0; i < statements.length; i++) {
			                  var statement = statements[i];
			                  if (statement) {
			                    value = statement(self, locals);
			                  }
			                }
			                return value;
			              };
			      }
			    }
			  },

			  filterChain: function() {
			    var left = this.expression();
			    var token;
			    while (true) {
			      if ((token = this.expect('|'))) {
			        left = this.binaryFn(left, token.fn, this.filter());
			      } else {
			        return left;
			      }
			    }
			  },

			  filter: function() {
			    var token = this.expect();
			    var fn = this.$filter(token.text);
			    var argsFn = [];
			    while (true) {
			      if ((token = this.expect(':'))) {
			        argsFn.push(this.expression());
			      } else {
			        var fnInvoke = function(self, locals, input) {
			          var args = [input];
			          for (var i = 0; i < argsFn.length; i++) {
			            args.push(argsFn[i](self, locals));
			          }
			          return fn.apply(self, args);
			        };
			        return function() {
			          return fnInvoke;
			        };
			      }
			    }
			  },

			  expression: function() {
			    return this.assignment();
			  },

			  assignment: function() {
			    var left = this.ternary();
			    var right;
			    var token;
			    if ((token = this.expect('='))) {
			      if (!left.assign) {
			        this.throwError('implies assignment but [' +
			            this.text.substring(0, token.index) + '] can not be assigned to', token);
			      }
			      right = this.ternary();
			      return function(scope, locals) {
			        return left.assign(scope, right(scope, locals), locals);
			      };
			    }
			    return left;
			  },

			  ternary: function() {
			    var left = this.logicalOR();
			    var middle;
			    var token;
			    if ((token = this.expect('?'))) {
			      middle = this.ternary();
			      if ((token = this.expect(':'))) {
			        return this.ternaryFn(left, middle, this.ternary());
			      } else {
			        this.throwError('expected :', token);
			      }
			    } else {
			      return left;
			    }
			  },

			  logicalOR: function() {
			    var left = this.logicalAND();
			    var token;
			    while (true) {
			      if ((token = this.expect('||'))) {
			        left = this.binaryFn(left, token.fn, this.logicalAND());
			      } else {
			        return left;
			      }
			    }
			  },

			  logicalAND: function() {
			    var left = this.equality();
			    var token;
			    if ((token = this.expect('&&'))) {
			      left = this.binaryFn(left, token.fn, this.logicalAND());
			    }
			    return left;
			  },

			  equality: function() {
			    var left = this.relational();
			    var token;
			    if ((token = this.expect('==','!=','===','!=='))) {
			      left = this.binaryFn(left, token.fn, this.equality());
			    }
			    return left;
			  },

			  relational: function() {
			    var left = this.additive();
			    var token;
			    if ((token = this.expect('<', '>', '<=', '>='))) {
			      left = this.binaryFn(left, token.fn, this.relational());
			    }
			    return left;
			  },

			  additive: function() {
			    var left = this.multiplicative();
			    var token;
			    while ((token = this.expect('+','-'))) {
			      left = this.binaryFn(left, token.fn, this.multiplicative());
			    }
			    return left;
			  },

			  multiplicative: function() {
			    var left = this.unary();
			    var token;
			    while ((token = this.expect('*','/','%'))) {
			      left = this.binaryFn(left, token.fn, this.unary());
			    }
			    return left;
			  },

			  unary: function() {
			    var token;
			    if (this.expect('+')) {
			      return this.primary();
			    } else if ((token = this.expect('-'))) {
			      return this.binaryFn(Parser.ZERO, token.fn, this.unary());
			    } else if ((token = this.expect('!'))) {
			      return this.unaryFn(token.fn, this.unary());
			    } else {
			      return this.primary();
			    }
			  },

			  fieldAccess: function(object) {
			    var parser = this;
			    var field = this.expect().text;
			    var getter = getterFn(field, this.options, this.text);

			    return extend(function(scope, locals, self) {
			      return getter(self || object(scope, locals), locals);
			    }, {
			      assign: function(scope, value, locals) {
			        return setter(object(scope, locals), field, value, parser.text, parser.options);
			      }
			    });
			  },

			  objectIndex: function(obj) {
			    var parser = this;

			    var indexFn = this.expression();
			    this.consume(']');

			    return extend(function(self, locals) {
			      var o = obj(self, locals),
			          i = indexFn(self, locals),
			          v, p;

			      if (!o) return undefined;
			      v = ensureSafeObject(o[i], parser.text);
			      if (v && v.then && parser.options.unwrapPromises) {
			        p = v;
			        if (!('$$v' in v)) {
			          p.$$v = undefined;
			          p.then(function(val) { p.$$v = val; });
			        }
			        v = v.$$v;
			      }
			      return v;
			    }, {
			      assign: function(self, value, locals) {
			        var key = indexFn(self, locals);
			        // prevent overwriting of Function.constructor which would break ensureSafeObject check
			        var safe = ensureSafeObject(obj(self, locals), parser.text);
			        return safe[key] = value;
			      }
			    });
			  },

			  functionCall: function(fn, contextGetter) {
			    var argsFn = [];
			    if (this.peekToken().text !== ')') {
			      do {
			        argsFn.push(this.expression());
			      } while (this.expect(','));
			    }
			    this.consume(')');

			    var parser = this;

			    return function(scope, locals) {
			      var args = [];
			      var context = contextGetter ? contextGetter(scope, locals) : scope;

			      for (var i = 0; i < argsFn.length; i++) {
			        args.push(argsFn[i](scope, locals));
			      }
			      var fnPtr = fn(scope, locals, context) || noop;

			      ensureSafeObject(context, parser.text);
			      ensureSafeObject(fnPtr, parser.text);

			      // IE stupidity! (IE doesn't have apply for some native functions)
			      var v = fnPtr.apply
			            ? fnPtr.apply(context, args)
			            : fnPtr(args[0], args[1], args[2], args[3], args[4]);

			      return ensureSafeObject(v, parser.text);
			    };
			  },

			  // This is used with json array declaration
			  arrayDeclaration: function () {
			    var elementFns = [];
			    var allConstant = true;
			    if (this.peekToken().text !== ']') {
			      do {
			        var elementFn = this.expression();
			        elementFns.push(elementFn);
			        if (!elementFn.constant) {
			          allConstant = false;
			        }
			      } while (this.expect(','));
			    }
			    this.consume(']');

			    return extend(function(self, locals) {
			      var array = [];
			      for (var i = 0; i < elementFns.length; i++) {
			        array.push(elementFns[i](self, locals));
			      }
			      return array;
			    }, {
			      literal: true,
			      constant: allConstant
			    });
			  },

			  object: function () {
			    var keyValues = [];
			    var allConstant = true;
			    if (this.peekToken().text !== '}') {
			      do {
			        var token = this.expect(),
			        key = token.string || token.text;
			        this.consume(':');
			        var value = this.expression();
			        keyValues.push({key: key, value: value});
			        if (!value.constant) {
			          allConstant = false;
			        }
			      } while (this.expect(','));
			    }
			    this.consume('}');

			    return extend(function(self, locals) {
			      var object = {};
			      for (var i = 0; i < keyValues.length; i++) {
			        var keyValue = keyValues[i];
			        object[keyValue.key] = keyValue.value(self, locals);
			      }
			      return object;
			    }, {
			      literal: true,
			      constant: allConstant
			    });
			  }
			};


			//////////////////////////////////////////////////
			// Parser helper functions
			//////////////////////////////////////////////////

			function setter(obj, path, setValue, fullExp, options) {
			  //needed?
			  options = options || {};

			  var element = path.split('.'), key;
			  for (var i = 0; element.length > 1; i++) {
			    key = ensureSafeMemberName(element.shift(), fullExp);
			    var propertyObj = obj[key];
			    if (!propertyObj) {
			      propertyObj = {};
			      obj[key] = propertyObj;
			    }
			    obj = propertyObj;
			    if (obj.then && options.unwrapPromises) {
			      promiseWarning(fullExp);
			      if (!("$$v" in obj)) {
			        (function(promise) {
			          promise.then(function(val) { promise.$$v = val; }); }
			        )(obj);
			      }
			      if (obj.$$v === undefined) {
			        obj.$$v = {};
			      }
			      obj = obj.$$v;
			    }
			  }
			  key = ensureSafeMemberName(element.shift(), fullExp);
			  obj[key] = setValue;
			  return setValue;
			}

			var getterFnCache = {};

			/**
			 * Implementation of the "Black Hole" variant from:
			 * 
			 * 
			 */
			function cspSafeGetterFn(key0, key1, key2, key3, key4, fullExp, options) {
			  ensureSafeMemberName(key0, fullExp);
			  ensureSafeMemberName(key1, fullExp);
			  ensureSafeMemberName(key2, fullExp);
			  ensureSafeMemberName(key3, fullExp);
			  ensureSafeMemberName(key4, fullExp);

			  return !options.unwrapPromises
			      ? function cspSafeGetter(scope, locals) {
			          var pathVal = (locals && locals.hasOwnProperty(key0)) ? locals : scope;

			          if (pathVal == null) return pathVal;
			          pathVal = pathVal[key0];

			          if (pathVal == null) return key1 ? undefined : pathVal;
			          pathVal = pathVal[key1];

			          if (pathVal == null) return key2 ? undefined : pathVal;
			          pathVal = pathVal[key2];

			          if (pathVal == null) return key3 ? undefined : pathVal;
			          pathVal = pathVal[key3];

			          if (pathVal == null) return key4 ? undefined : pathVal;
			          pathVal = pathVal[key4];

			          return pathVal;
			        }
			      : function cspSafePromiseEnabledGetter(scope, locals) {
			          var pathVal = (locals && locals.hasOwnProperty(key0)) ? locals : scope,
			              promise;

			          if (pathVal == null) return pathVal;

			          pathVal = pathVal[key0];
			          if (pathVal && pathVal.then) {
			            promiseWarning(fullExp);
			            if (!("$$v" in pathVal)) {
			              promise = pathVal;
			              promise.$$v = undefined;
			              promise.then(function(val) { promise.$$v = val; });
			            }
			            pathVal = pathVal.$$v;
			          }
			          if (pathVal == null) return key1 ? undefined : pathVal;

			          pathVal = pathVal[key1];
			          if (pathVal && pathVal.then) {
			            promiseWarning(fullExp);
			            if (!("$$v" in pathVal)) {
			              promise = pathVal;
			              promise.$$v = undefined;
			              promise.then(function(val) { promise.$$v = val; });
			            }
			            pathVal = pathVal.$$v;
			          }
			          if (pathVal == null) return key2 ? undefined : pathVal;

			          pathVal = pathVal[key2];
			          if (pathVal && pathVal.then) {
			            promiseWarning(fullExp);
			            if (!("$$v" in pathVal)) {
			              promise = pathVal;
			              promise.$$v = undefined;
			              promise.then(function(val) { promise.$$v = val; });
			            }
			            pathVal = pathVal.$$v;
			          }
			          if (pathVal == null) return key3 ? undefined : pathVal;

			          pathVal = pathVal[key3];
			          if (pathVal && pathVal.then) {
			            promiseWarning(fullExp);
			            if (!("$$v" in pathVal)) {
			              promise = pathVal;
			              promise.$$v = undefined;
			              promise.then(function(val) { promise.$$v = val; });
			            }
			            pathVal = pathVal.$$v;
			          }
			          if (pathVal == null) return key4 ? undefined : pathVal;

			          pathVal = pathVal[key4];
			          if (pathVal && pathVal.then) {
			            promiseWarning(fullExp);
			            if (!("$$v" in pathVal)) {
			              promise = pathVal;
			              promise.$$v = undefined;
			              promise.then(function(val) { promise.$$v = val; });
			            }
			            pathVal = pathVal.$$v;
			          }
			          return pathVal;
			        };
			}

			function simpleGetterFn1(key0, fullExp) {
			  ensureSafeMemberName(key0, fullExp);

			  return function simpleGetterFn1(scope, locals) {
			    if (scope == null) return undefined;
			    return ((locals && locals.hasOwnProperty(key0)) ? locals : scope)[key0];
			  };
			}

			function simpleGetterFn2(key0, key1, fullExp) {
			  ensureSafeMemberName(key0, fullExp);
			  ensureSafeMemberName(key1, fullExp);

			  return function simpleGetterFn2(scope, locals) {
			    if (scope == null) return undefined;
			    scope = ((locals && locals.hasOwnProperty(key0)) ? locals : scope)[key0];
			    return scope == null ? undefined : scope[key1];
			  };
			}

			function getterFn(path, options, fullExp) {
			  // Check whether the cache has this getter already.
			  // We can use hasOwnProperty directly on the cache because we ensure,
			  // see below, that the cache never stores a path called 'hasOwnProperty'
			  if (getterFnCache.hasOwnProperty(path)) {
			    return getterFnCache[path];
			  }

			  var pathKeys = path.split('.'),
			      pathKeysLength = pathKeys.length,
			      fn;

			  // When we have only 1 or 2 tokens, use optimized special case closures.
			  // http://jsperf.com/angularjs-parse-getter/6
			  if (!options.unwrapPromises && pathKeysLength === 1) {
			    fn = simpleGetterFn1(pathKeys[0], fullExp);
			  } else if (!options.unwrapPromises && pathKeysLength === 2) {
			    fn = simpleGetterFn2(pathKeys[0], pathKeys[1], fullExp);
			  } else if (options.csp) {
			    if (pathKeysLength < 6) {
			      fn = cspSafeGetterFn(pathKeys[0], pathKeys[1], pathKeys[2], pathKeys[3], pathKeys[4], fullExp,
			                          options);
			    } else {
			      fn = function(scope, locals) {
			        var i = 0, val;
			        do {
			          val = cspSafeGetterFn(pathKeys[i++], pathKeys[i++], pathKeys[i++], pathKeys[i++],
			                                pathKeys[i++], fullExp, options)(scope, locals);

			          locals = undefined; // clear after first iteration
			          scope = val;
			        } while (i < pathKeysLength);
			        return val;
			      };
			    }
			  } else {
			    var code = 'var p;\n';
			    forEach(pathKeys, function(key, index) {
			      ensureSafeMemberName(key, fullExp);
			      code += 'if(s == null) return undefined;\n' +
			              's='+ (index
			                      // we simply dereference 's' on any .dot notation
			                      ? 's'
			                      // but if we are first then we check locals first, and if so read it first
			                      : '((k&&k.hasOwnProperty("' + key + '"))?k:s)') + '["' + key + '"]' + ';\n' +
			              (options.unwrapPromises
			                ? 'if (s && s.then) {\n' +
			                  ' pw("' + fullExp.replace(/(["\r\n])/g, '\\$1') + '");\n' +
			                  ' if (!("$$v" in s)) {\n' +
			                    ' p=s;\n' +
			                    ' p.$$v = undefined;\n' +
			                    ' p.then(function(v) {p.$$v=v;});\n' +
			                    '}\n' +
			                  ' s=s.$$v\n' +
			                '}\n'
			                : '');
			    });
			    code += 'return s;';

			    /* jshint -W054 */
			    var evaledFnGetter = new Function('s', 'k', 'pw', code); // s=scope, k=locals, pw=promiseWarning
			    /* jshint +W054 */
			    evaledFnGetter.toString = valueFn(code);
			    fn = options.unwrapPromises ? function(scope, locals) {
			      return evaledFnGetter(scope, locals, promiseWarning);
			    } : evaledFnGetter;
			  }

			  // Only cache the value if it's not going to mess up the cache object
			  // This is more performant that using Object.prototype.hasOwnProperty.call
			  if (path !== 'hasOwnProperty') {
			    getterFnCache[path] = fn;
			  }
			  return fn;
			}


			// 字符串解析核心函数-----------end-----------

			root.$parse = {
				Lexer: Lexer,
				Parser: Parser
			}
	})(_);


	// 保存过滤函数
	_.methods = [];
	// 查询过滤函数
	function $$helper(fnname){
		var fn = noop;
		_.methods.forEach(function(v, k){
			if(Array.isArray(v)){
				if(v[0] == fnname){
					fn = v[1];
				}
			}
		});
		return fn;
	}
		
	var $parse = _.$parse;
	// 支持四则运算以及三元运算,一元运算符
	function $$parse(key, context){
		var parseOptions = {
			csp: false,
		    unwrapPromises: false,
		    logPromiseWarnings: true
		}
		var lexer = new $parse.Lexer(parseOptions);
		var parser = new $parse.Parser(lexer, $$helper, parseOptions);
		return parser.parse(key,false)(context);
	}
	_.template = function(info, data){
		// 不支持运算，只支持变量赋值
		function $$getValue(key, context){
			// a.b.c => context.a.b.c
			var args = key.split('.');
			while(args.length){
				var k = args.shift();
				if(context[k]){
					context = context[k];
				}
			}
			if(Array.isArray(context)) return context;
			if(typeof context == 'object') return '';
			return context;
		}
		
		// 生成最后返回的字符串
		function $$build(context){
			info = info.replace(/[\r\n]+/g, '');
			info = '<% if(1) {%>' + info + '<% } %>';
			var tree = buildTree();
			parseTree(tree);
			// 除掉所有$数字wrap
			info = info.replace(/\$[\d]+/g, '');
			// 除掉不在if,for里的模型red
			info = 'var __context = this;var result = [];' + info + ';return result.join(\'\');';
			var fn = new Function(info);
			return fn.call(data);
		}
		// 生成表达式树
		function buildTree(){
			var tree = {};
			var nif = 0;
			var open; //默认关闭
			var init = true;
			var findLastNoEnd = function(nif){
				var lastNoEnd;
				for(var i  in tree){
					if(nif){
						if(i < nif){
							if(!tree[i].end){
								lastNoEnd = tree[i];
							}
						}
					}else{
						if(!tree[i].end){
							lastNoEnd = tree[i];
						}
					}	
				}
				return lastNoEnd;
			}
			info = info.replace(regor, function($0, $1, $2, $3, $4, $5, $6, index, input){
				// $6 代表结束
				// $1 代表开始 $3代表if $4代表for $5代表开始里的值
				if($1){
					// if ==>
					if(open) nif++;
					if(!init && !open) nif++;
					tree[nif] = {
						id: nif
					};
					if(nif != 0){
						// 找最近的没有关闭的tree
						var parent = findLastNoEnd(nif);
						if(parent){
							parent.childs = parent.childs || [];
							parent.childs.push(tree[nif]);
							tree[nif].parent = parent; 
						}	
					}else{
						tree[nif].parent = null;
					}
					tree[nif].value = $5;
					// $1 = '$' + nif + $1 + '$' + nif;
					var $var = 'i' + nif;
					var newKey, oldContext;
					tree[nif].value.replace(regfor, function($0, $1, $2){
						newKey = String($1).trim();
						oldContext = String($2).trim();
					});
					if($3){
						tree[nif].type = 'if';
						
						if(tree[nif].parent && tree[nif] == tree[nif].parent.childs[0]){
							if (!checkForParent(tree[nif])){
								$1 = 'if(!!_.parse(\"' + tree[nif].value + '\",__context)) { result.push(\''; 
								$1 = 'var __context = this ;' + $1;
							}else{
								$1 = 'if(' + tree[nif].value + ') { result.push(\''; 
							}
							$1 = '\');' + $1;
						}else if(!tree[nif].parent){
							// 此时还要替换if中的表达式
							$1 = 'if(!!_.parse(\"' + tree[nif].value + '\",__context)) { result.push(\''; 
							// $1 = 'var __context = this ;' + $1;
						}else if (!checkForParent(tree[nif])){
							// 此时还要替换if中的表达式
							$1 = 'if(!!_.parse(\"' + tree[nif].value + '\",__context)) { result.push(\''; 
							$1 = 'var __context = this ;' + $1;
						}
						$1 = '$' + nif + $1 + '$' + nif;
					}else if($4){
						tree[nif].type = 'for';
						// 保存for上下文的变量
						tree[nif].key = newKey;
						tree[nif].args = oldContext;
						$1 = 'for(var ' + $var + '=0;' + $var + ' < ' + oldContext + '.length;' + $var + '++) { ' + 'var ' + newKey + ' = '+ oldContext +'['+$var+'];'+   ' var  __context = {};__context[\''+ newKey +'\'] = ' + oldContext +    '[' + $var+ '];'+  ' result.push(\''; 
						if(tree[nif].parent && tree[nif] == tree[nif].parent.childs[0]){
							if(!checkForParent(tree[nif])){
								$1 = 'var '+ oldContext +' = this.' + oldContext+';' + $1;
							}
							$1 = '\');' + $1;
						}else if (!checkForParent(tree[nif])){
							$1 = 'var '+ oldContext +' = this.' + oldContext+';' + $1;
						}
						$1 = '$' + nif + $1 + '$' + nif;
					}
					tree[nif].start = $1;
					open = true;
					init = false;
					return $1;
				}else if($6){
					// }   <==
					open = false;
					init = false;
					var end = findLastNoEnd();
					var id = end.id;
					// $6 = '$' + id + $6 + '$' + id;
					if(end.childs){
						$6 = ' } ';
					}else{
						$6 = ' \');} ';
					}
					$6 = '$' + id + $6 + '$' + id;
					end.end = $6;
					return $6;
				}
			});
			return tree;
		}
		function buildModel(tree){
			var base = '(\\$' + tree.id + '\\s*[\\s\\S]+\\s*\\$' + tree.id + ')([\\s\\S]+)(\\$' + tree.id + '\\s*[\\s\\S]+\\s*\\$' + tree.id + ')';
			info = info.replace(new RegExp(base, 'g'), function($0, $1, $2, $3){
				// $1 为for里面的值
				$2 = $2.replace(regModel, function($0, $1){
					$1  = '\' + _.parse(\'' + $1 + '\',__context) + \'';
					return $1;
				});
				return $1 + $2 + $3
			});
		}
		// 检查if树的父节点没有没for
		function checkForParent(tree){
			var temp = tree;
			while(1){
				temp  = temp.parent;
				if(!temp) return temp;
				if(temp.type == 'for'){
					return temp;
				}
			}
			return temp;
		}
		/**
		* 新增解析方法，使用深度树遍历算法
		* 
		**/
		function parseTree(tree, context){
			for(var i in tree){
				var childs = tree[i].childs;
				if(childs && childs.length){
					parseTree(childs);
				}
				buildModel(tree[i]);
			}
		}
		if(!data){
			return function(context){
				return $$build(context);
			}
		}else{
			return $$build(data);
		}
	};
	_.parse = $$parse;
	// 增加一个转换数据的默认过滤器
	_.methods.push(['number', function(text){
		return Number(text);
	}]);
	if(typeof define !== 'undefined'){
		// 添加到define函数里去
		define('template', function(exports, require, module){
			module.exports = _;
		})
	}
	if(typeof module !== 'undefined' && module.exports != 'undefined'){
		module.exports = _;
	}
	root.$template = _;
	return _;
})(this);