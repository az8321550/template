## $template 字符串模板库

`$template`是一个简单高效的字符串模板引擎,有关解析表达式的部分参考了`ng`里的`$parse`服务.

### 字符串替换

`$template`提供了`es6`里的字符串模板功能,用法如下

```js

  $template.template('hello {{name}}', { name: 'feenan'}); // => hello feenan

```

支持四则运算

```js

//  + - *  /

$template.template('(1+2)*age = {{ (1+2)*age}}', {age: 18}); // => (1+2)*age = 54

```

支持各种比较操作符

```js

// > < >= <= == === !== !=
$template.template('1>2', {}); // => false

$template.template('age > 18', {age: 20}); // => true

```

支持三元运算符

```js

$template.template('{{ 2 > 1 ? name : ""}}', {name: 'feenan'}); // => feenan

```

### 条件判断if

`$template`支持`if`语句来判断是否显示字符串的某部分,这里采用`<% %>`来显示程序语法

```html

	<p>check if statment</p>
	<% if(showFn()) { %>
		<h1>hello1 {{ user.name }}</h1>
		<% if(user.age == 1) { %>
			<h2>hello2 {{ user.action | substr:1}}</h2>
		<% } %>
		<% if(user.age == 1) { %>
			<h3>hello3 {{ user.action }}</h3>
			<% for(user in users) {%>
				<h1>hello {{user.name}}</h1>
			<% } %>
			<% if(user.age == 1) { %>
				<h4> hello4 {{ user.name}}</h4>
			<% } %>
		<% } %>
	<% } %>	

```

```js

var fn = $template.template(html);
var data = {
	showFn: function(){
		return true;
	},
	showh1: true,
	user: {
		name: 'feenan',
		info: 'haha',
		action: 'start',
		age: 2
	},
	users:[
		{name: 'feenan', info: 'haha'},
		{name: 'feenan1', info: 'haha1'}
	]
}
fn(data);
```

> 注意: 假如`$template.template`只传递字符串的话会返回一个编译函数,下次传递数据才会生成最后的字符串.

目前`if`语句支持无限嵌套`if语句`,支持嵌套`for`语句.

```html

	<% if(user.age > 1) {%>
		<% for(user in users) {%>
			<h1>hello {{user.name}}</h1>
		<% } %>
		<% for(user in users) {%>
			<h2>hello {{user.name}}</h2>
		<% } %>
	<% }%>

```

### 循环语句for

目前`for`语句支持无限嵌套`if`语句,支持嵌套`for`本身.

```html

	<% for(user in users) {%>
		<h1>hello {{user.name}}</h1>
		<% if(user.name) { %>
			<h2>hello2 {{ user.info}}</h2>
		<% } %>
		<% for(action in user.actions) {%>
			<h3>hello 3 {{action.name}}</h3>
		<% }%>
	<% } %>

```

### 过滤函数

目前支持以管道符号`|`来执行过滤函数,对外提供扩展属性的方式来增加自定义过滤函数.扩展属性通过`$template.methods`数组来实现.

```js

$template.methods.push(['int', function(src, len){
	var str  = String(src).substr(0, len);
	return Number(str);
}]);

$template.template('your age is {{ age | int:5 }}', { age: '50'}); // => 50

```

过滤函数支持传递参数,方法名后面传递`:`后跟值就可以.

### 待改进的地方

* `if`语句增加`else`功能
* 增加字符串安全过滤功能

### 总结

现在模板引擎非常多,希望这个小小的`js`库大家会喜欢,有问题可以提`github`上.












