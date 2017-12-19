var Stream = require('../src/index.js');

function interval(ms) {
	return Stream.create(function(n, e, d) {
		var counter = 0;
		var int = setInterval(function() {
			n(counter++);
		}, ms);

		return function dispose() {
			console.log('disposed!');
			clearInterval(int);
		}
	});
}

var comp = interval(1000).chain(x => interval(300).map(v => v * x));

/*
var disp = comp.fork(function(v) {
	console.log(v);

	if (v === 4)
		disp();
}, function() {}, function() { });*/

/*
var disp2 = comp.fork(function(v) {
	console.log('two', v);

	if (v === 50)
		disp2();
}, function() {}, function() { });*/

/*
var fn = interval(1000).map(n => v => n * v).start(_ => 'hey');

var vals = interval(100);

fn.app(vals).fork(function(v) {
	console.log(v);
});*/

/*
var o = Stream.of(1);
var t = Stream.of(2);
o.seqR(t).fork(function(v) {
	console.log(v);
});*/

/*
var xs = Stream.fromList([1,2,3,4]);

xs.fork(function(v) {
	console.log(v);
})
xs.fork(function(v) {
	console.log(v);
})*/

/*
interval(100).map(x => x * 2).filter(x => x % 2 === 0).take(10).subscribe({
	next(v) {
		console.log(v);
	},
	complete() {
		console.log('done');
	}
});*/

/*
var s = Stream.fromList([
	Stream.of(1).delay(1000).start(20),
	Stream.of(2)
]).concat().observe(x => console.log(x)).then(x => console.log('done'));*/

/*
Stream.of(1).then(Stream.of(2)).subscribe({
	next(v) {
		console.log(v);
	},
	complete() {
		console.log('done');
	}
})*/

/*
function sum(acc, v) {
	return acc + v;
}

function blah(state, v) {
	if (state % 2 === 0)
		v = 'blah';

	return {
		state: state + 1,
		value: v
	};
}

Stream.fromList([1,2,3,4]).withState(blah, 1).subscribe({
	next(v) {
		console.log(v);
	},
	complete() {
		console.log('done');
	}
});
*/

/*
var vvv;
Stream.iterate(function(x) {
	return x + 1;
}, 0).scan((a,x) => a + x, 0).take(4000).subscribe({
	next(v) {
		vvv = v;
	},
	complete() {
		console.log('done', vvv);
	}
});*/

/*
Stream.empty().subscribe({
	next(v) {
		console.log(v);
	},
	complete() {
		console.log('done');
	}
});*/

/*
var a = interval(10).map(x => String.fromCharCode(x % 26 + 65));
var b = interval(100);
var c = Stream.of([1,2,3]);*/

/*
var a = Stream.fromList(['a', 'b']);
var b = interval(100);
var c = Stream.of('hi');

var x = a.combine(b, c);
x.subscribe({
	next(v) {
		console.log(v);
	},
	complete() {
		console.log('done');
	}
});*/

/*
var a = Stream.of(100).tap(console.log).multicast();

a.subscribe({
	next(v) {
		console.log(v);
	},
	complete() {
		console.log('done');
	}
});
a.map(x => x * 2).subscribe({
	next(v) {
		console.log(v);
	},
	complete() {
		console.log('done');
	}
});*/


/*
Stream.range(5, 100).subscribe({
	next(v) {
		console.log(v);
	},
	complete() {
		console.log('done');
	}	
})*/


/*
function delay(ms) {
	return new Promise(function(res) {
		setTimeout(res, ms, ms);
	});
}

Stream.iterate(function(x) {
	return delay(x + 1);
}, 0).take(100).subscribe({
	next(v) {
		console.log(v);
	},
	complete() {
		console.log('done');
	}	
});*/

var a = interval(100).take(10);
var b = interval(500).take(3);

var c = Stream.fromList([a, b]).merge();

c.subscribe({
	next(v) {
		console.log(v);
	},
	complete() {
		console.log('done');
	}	
});