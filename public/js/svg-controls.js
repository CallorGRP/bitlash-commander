//
// svg-controls.js: SVG control library for Bitlash Commander
//
//	Copyright 2012 Bill Roy (MIT License; see LICENSE file)
//

//////////
//
//	ControlPanel object
//
function ControlPanel(options) {
	return this.init(options || {});
}

ControlPanel.prototype = {

	init: function(options) {
		this.w = options.w || $(window).width();
		this.h = options.h || $(window).height();
		this.x = options.x || ($(window).width() - this.w)/2;
		this.y = options.y || ($(window).height() - this.h)/2;
		this.color = options.color || 'greenyellow';
		this.fill = options.fill || 'black';
		this.fill_highlight = options.fill_highlight || 'white';
		this.stroke = options.stroke || this.color;
		this.face_corner = options.face_corner || 20;
		this.button_corner = options.button_corner || 10;
		this.control_stroke = options.control_stroke || 3;
		this.title = options.title || 'Bitlash Commander';
		this.channel = options.channel || '';

		this.paper = Raphael(0, 0, $(window).width(), $(window).height());

		this.face = this.paper.rect(this.x, this.y, this.w, this.h, this.face_corner)
			.attr({stroke: this.stroke, fill: this.fill, 'stroke-width': 2 * this.control_stroke});
		
		this.logo = this.paper.text(this.x + (this.w/2), this.y + 50, this.title)
			.attr({fill:this.stroke, stroke:this.stroke, 'font-size': 36});

		var self = this;
		this.editbutton = this.paper.path('M25.31,2.872l-3.384-2.127c-0.854-0.536-1.979-0.278-2.517,0.576l-1.334,2.123l6.474,4.066l1.335-2.122C26.42,4.533,26.164,3.407,25.31,2.872zM6.555,21.786l6.474,4.066L23.581,9.054l-6.477-4.067L6.555,21.786zM5.566,26.952l-0.143,3.819l3.379-1.787l3.14-1.658l-6.246-3.925L5.566,26.952z')
			.transform('T25,25')
			.attr({fill:this.fill, stroke: this.stroke})
			.click(function(e) { 
				self.editing = !self.editing;
				if (self.editing) self.editbutton.attr({fill:self.stroke, stroke:self.stroke});
				else self.editbutton.attr({fill:self.fill, stroke: self.stroke});
			});

		this.controls = {};
		this.next_id = 0;
		this.editing = options.editing || false;
		this.initSocketIO();
		this.sync();
		return this;
	},

	attr: function(attrs) {
		this.face.attr(attrs);
		//this.logo.attr(attrs);
		for (var id in this.controls) this.controls[id].attr(attrs);
		return this;
	},

	initSocketIO: function() {
		this.socket = io.connect();
		console.log('Socket connected', this.socket);

		var self = this;
//		this.socket.on('reply', function (data) {
//			console.log('Bitlash reply???:', data);
//			var reply_handler = self.reply_handlers.pop();
//			if (reply_handler) reply_handler(data);
//		});
		this.socket.on('update', function(data) {
			//console.log('Update:', data);
			if (typeof data[0] == 'undefined') data = [data];
			for (var i=0; i < data.length; i++) {
				if (self.controls[data[i].id]) self.controls[data[i].id].setValue(data[i].value);
			}
		});
		this.socket.on('rexec', function(data) {
			console.log('rexec:', data);
			//self.sendCommand('exec', data);		// ugly kludge, fixing...
		});
		this.socket.on('pong', function(data) {
			var rtt = new Date().getTime() - data.timestamp;
			window.status = 'RTT: ' + rtt + 'ms';
		});
		this.socket.on('disconnect', function (data) {
			console.log('Socket Disconnected:', data);
			//connection_indicator.attr({stroke: 'darkgreen', fill: 'darkgreen'});		
			window.setTimeout(self.initSocketIO, 200);
		});

		if (0) window.setInterval(function() {
			self.socket.emit('ping', {'timestamp': new Date().getTime()});
		}, 10000);
	},
	
	sync: function() {
		this.socket.emit('sync', {});
	},

	addButton: function(options) {
		options.parent = this;
		var button = new Button(options);
		this.controls[button.id] = button;
		if (button.autorun) button.handleClick();
		return button;
	},

	addSlider: function(options) {
		options.parent = this;
		var slider = new Slider(options);
		this.controls[slider.id] = slider;
		return slider;
	},

	addChart: function(options) {
		options.parent = this;
		var chart = new Chart(options);
		this.controls[chart.id] = chart;
		if (chart.autorun) chart.handleClick();
		return chart;
	},

	sendCommand: function(command, data, reply_handler) {
		this.socket.emit(command, data);
	},

	sendUpdate: function(command, data) {
		this.socket.emit(command, data);
	},
	
	lighter: function(color) {
		var rgb = Raphael.getRGB(color);
		var hsb = Raphael.rgb2hsb(rgb.r, rgb.g, rgb.b);
		var newb = Math.min(1, hsb.b*2);
		return Raphael.hsb2rgb(hsb.h, hsb.s, newb).hex;
	}
}


//////////
//
//	Button control
//
function Button(options) {
	return this.init(options || {});
}

Button.prototype = {

	init: function(options) {
		this.parent = options.parent;
		this.id = options.id || 'Button' + this.parent.next_id++;
		if (this.parent.channel.length) this.id = '' + this.parent.channel + '.' + this.id;
		this.x = this.parent.x + (options.x || 50);
		this.y = this.parent.y + (options.y || 50);
		this.w = options.w || 125;
		this.h = options.h || 50;
		this.text = options.text || 'Untitled';
		this.script = options.script || '';
		this.stroke = options.stroke || this.parent.color;
		this.fill = options.fill || 'black';
		this.fill_highlight = options.fill_highlight || this.parent.lighter(this.stroke);
		this['stroke-width'] = options['stroke-width'] || this.parent.control_stroke;
		this.fontsize = options.fontsize || 20;
		this.repeat = options.repeat || 0;
		this.running = 0;
		this.corner = options.corner || this.parent.button_corner;
		this.shape = options.shape || '';	// default to rectangle
		this.r = options.r || this.w/2;
		this.autorun = options.autorun || false;
		this.value = options.value || 0;
		this.path = options.path || undefined;
		this.scale = options.scale || 1;

		this.listeners = {};	// hash of arrays of listeners, keyed by eventname

		var self = this;

		if (this.shape == 'circle') {
			this.elt = this.parent.paper.circle(this.x, this.y, this.r)
				.attr({fill:this.fill, stroke:this.stroke, 'stroke-width': this['stroke-width']})
				.click(function(e) { return self.handleClick.call(self, e); })
				.mousedown(function(e) { self.elt.attr({fill:self.fill_highlight}); })
				.mouseup(function(e) { self.elt.attr({fill:self.fill});})
				.drag(this.dragMove, this.dragStart, this.dragEnd, this, this, this);

			this.label = this.parent.paper.text(this.x + (this.w/2), this.y + 2*this.r + this.fontsize, this.text)
				.attr({fill:this.stroke, stroke:this.stroke, 'font-size': this.fontsize-2})
				.click(function(e) { return self.handleClick.call(self, e); })
				.mousedown(function(e) { self.elt.attr({fill:self.fill_highlight}); })
				.mouseup(function(e) { self.elt.attr({fill:self.fill});})
				.drag(this.dragMove, this.dragStart, this.dragEnd, this, this, this);

			this.readout = this.parent.paper.text(this.x, this.y, this.value)
				.attr({fill:this.stroke, stroke:this.stroke, 'font-size': this.fontsize})
				.click(function(e) { return self.handleClick.call(self, e); })
				.mousedown(function(e) { self.elt.attr({fill:self.fill_highlight}); })
				.mouseup(function(e) { self.elt.attr({fill:self.fill});})
				.drag(this.dragMove, this.dragStart, this.dragEnd, this, this, this);
		}
		else if (this.shape == 'path') {	// path button
			var translation = ['t', this.x, ',', this.y, 's', this.scale].join('');
			//var translation = ['T600,600'].join('');
console.log('Path:', translation, this.x, this.y, this.scale);

			this.elt = this.parent.paper.path(this.path)
				.transform(translation)
				//.scale(this.scale)
				.attr({fill:this.fill, stroke:this.stroke, 'stroke-width': this['stroke-width']})
				.click(function(e) { return self.handleClick.call(self, e); })
				.mousedown(function(e) { self.elt.attr({fill:self.fill_highlight}); })
				.mouseup(function(e) { self.elt.attr({fill:self.fill});})
				.drag(this.dragMove, this.dragStart, this.dragEnd, this, this, this);

			var bbox = this.elt.getBBox();
			this.w = bbox.width;
			this.h = bbox.height;
			var labely = bbox.y + this.h + this.fontsize;

			this.label = this.parent.paper.text(this.x, labely, this.text)
				.attr({fill:this.stroke, stroke:this.stroke, 'font-size': this.fontsize-2})
				.click(function(e) { return self.handleClick.call(self, e); })
				.mousedown(function(e) { self.elt.attr({fill:self.fill_highlight}); })
				.mouseup(function(e) { self.elt.attr({fill:self.fill});})
				.drag(this.dragMove, this.dragStart, this.dragEnd, this, this, this);

			this.readout = this.parent.paper.text(this.x, this.y, this.value)
				.attr({fill:this.stroke, stroke:this.stroke, 'font-size': this.fontsize})
				.click(function(e) { return self.handleClick.call(self, e); })
				.mousedown(function(e) { self.elt.attr({fill:self.fill_highlight}); })
				.mouseup(function(e) { self.elt.attr({fill:self.fill});})
				.drag(this.dragMove, this.dragStart, this.dragEnd, this, this, this);
		}
		else {		// default rectangular button
			this.elt = this.parent.paper.rect(this.x, this.y, this.w, this.h, this.corner)
				.attr({fill:this.fill, stroke:this.stroke, 'stroke-width': this['stroke-width']})
				.click(function(e) { return self.handleClick.call(self, e); })
				.mousedown(function(e) { self.elt.attr({fill:self.fill_highlight}); })
				.mouseup(function(e) { self.elt.attr({fill:self.fill});})
				.drag(this.dragMove, this.dragStart, this.dragEnd, this, this, this);

			//this.label = this.parent.paper.text(this.x + (this.w/2), this.y + (this.h/2), this.text)
			this.label = this.parent.paper.text(this.x + (this.w/2), this.y + this.h + this.fontsize, this.text)
				.attr({fill:this.stroke, stroke:this.stroke, 'font-size': this.fontsize})
				.click(function(e) { return self.handleClick.call(self, e); })
				.mousedown(function(e) { self.elt.attr({fill:self.fill_highlight}); })
				.mouseup(function(e) { self.elt.attr({fill:self.fill});})
				.drag(this.dragMove, this.dragStart, this.dragEnd, this, this, this);

			this.readout = this.parent.paper.text(this.x + (this.w/2), this.y + this.h/2, ''+this.value)
				.attr({fill:this.stroke, stroke:this.stroke, 'font-size': this.fontsize-2})
				.drag(this.dragMove, this.dragStart, this.dragEnd, this, this, this);
		}

		return this;
	},
	
	attr: function(attrs) {
		this.elt.attr(attrs);
		//this.label.attr(attrs);
	},

	dragStart: function(x, y, event) {
console.log('Drag start:', x, y, event);
		if (!this.parent.editing) return true;
		this.drag = {x:this.x, y:this.y, xoff: x-this.x, yoff: y-this.y};
		this.dragging = true;
		this.elt.attr({fill:this.fill_highlight}).toFront();
		this.readout.toFront();
		this.label.toFront();
	},

	dragMove: function(dx, dy, x, y, e) {
		console.log('move:',dx,dy,x,y,e);
		this.x = this.drag.x + dx;
		this.y = this.drag.y + dy;
		if (this.shape == 'circle') {
			this.elt.attr({cx:x-this.drag.xoff, cy:y-this.drag.yoff});
			this.label.attr({cx:x-this.drag.xoff, cy:y-this.drag.yoff});		//??
			this.readout.attr({x:x-this.drag.xoff, y:y-this.drag.yoff});
		}
		else if (this.shape == 'path') {
			var bbox = this.elt.getBBox();
			this.elt.transform(['t', this.x-this.drag.xoff, ',', this.y-this.drag.yoff, 's', this.scale].join(''));
			var labely = bbox.y + this.h + this.fontsize;
			this.label.attr({x:x-this.drag.xoff, y:labely - this.drag.yoff});
			this.readout.attr({x:x-this.drag.xoff , y:y-this.drag.yoff});
		}
		else {
			this.elt.attr({x:x-this.drag.xoff, y:y-this.drag.yoff});
			this.label.attr({x:x-this.drag.xoff + this.w/2, y:y-this.drag.yoff + this.h + this.fontsize});
			this.readout.attr({x:x-this.drag.xoff + this.w/2, y:y-this.drag.yoff + this.h/2});
		}
		return this.dragFinish(e);
	},

	dragEnd: function(e) {
		this.elt.attr({fill:this.fill});
		delete this.drag;
		this.dragging = false;
		return this.dragFinish(e);
	},
	
	dragFinish: function(e) {
		e.preventDefault();
		e.stopPropagation();
		return false;
	},

	handleClick: function(e) {
		if (this.repeat) {
			if (this.running) {
				this.running = false;
				clearInterval(this.intervalid);
				delete this.intervalid;
			} else {
				this.running = true;
				this.exec();
			}
		}
		else this.exec();

		if (e) {
			e.preventDefault();
			e.stopPropagation();
		}
		return false;
	},

	exec: function() {
		if (!this.script) {
			this.setValue(!this.value);		// unscripted buttons toggle and gossip
			return;
		}
		var cmd = Mustache.render(this.script, this);
		console.log('button exec:', cmd);

		if (cmd.match(/^javascript\:/)) {			// javascript command
			cmd = cmd.replace('javascript:', '');
			eval(cmd);
		}
		else {										// bitlash command
			var self = this;
			var reply_handler = function(reply) { self.handleReply.call(self, reply); };
			this.parent.sendCommand('exec', {'cmd': cmd, 'id':this.id}, reply_handler);
		}
		if (this.repeat && !this.intervalid) {
			var self = this;
			this.intervalid = setInterval(function() { self.exec.call(self, {}); }, this.repeat);
		}
	},

/*
	handleReply: function(reply) {
		console.log("UNEXPECTED REPLY");
		if (reply === undefined) return;
		this.reply = reply.trim();
		if (this.reply.length == 0) return;
		this.setValue(this.reply);
		var update = {id: this.id, value: this.value};
		this.parent.sendUpdate('update', update);
		this.fire('update', update);
	},
*/
	
	setValue: function(value) {
		this.value = value;
		//this.label.attr({text: this.text + ': ' + this.value});
		this.readout.attr({text: '' + this.value});
		var update = {id: this.id, value: this.value};
		this.fire('update', update);
	},

	on: function(eventname, listener) {
		if (!this.listeners[eventname]) this.listeners[eventname] = [];
		this.listeners[eventname].push(listener);
		//console.log('On:', this.id, this.listeners.length, this.listeners);
	},

	fire: function(eventname, data) {
		var listeners = this.listeners[eventname];
		//console.log('listeners:', listeners);
		if (!listeners) return;
		for (var i=0; i<listeners.length; i++) {
			var func = listeners[i];
			//console.log('firing listener', i, data);
			func(data);
		}
	}	
}


//////////
//
//	Slider control
//
function Slider(options) {
	return this.init(options || {});
}

Slider.prototype = {

	init: function(options) {
		this.parent = options.parent;
		this.id = options.id || 'Slider' + this.parent.next_id++;
		if (this.parent.channel.length) this.id = '' + this.parent.channel + '.' + this.id;
		this.x = this.parent.x + (options.x || 50);
		this.y = this.parent.y + (options.y || 50);
		this.w = options.w || 80;
		this.h = options.h || 200;
		this.text = options.text || 'Untitled';
		this.script = options.script || '';
		this.fill = options.fill || this.parent.fill;
		this.fill_highlight = options.fill_highlight || 'white';
		this.stroke = options.stroke || this.parent.color;
		this['stroke-width'] = options['stroke-width'] || this.parent.control_stroke;
		this.fontsize = options.fontsize || 20;

		this.listeners = {};	// hash of arrays of listeners, keyed by eventname

		this.min = options.min || 0;
		this.max = options.max || 255;
		this.value = options.value || this.min;

		this.slidew = .8 * this.w;
		this.slideh = options.slideh || 1+Math.floor(this.h / 12);

		this.barw = options.barw || 1;	//1+Math.floor(this.w / 16);
		this.barh = this.h;

		var self = this;

		this.outerrect = this.parent.paper.rect(this.x, this.y, this.w, this.h + this.slideh, 10)
			.attr({fill:this.fill, stroke:this.stroke, 'stroke-width':this.parent.control_stroke})
			.drag(this.dragMove, this.dragStart, this.dragEnd, this, this, this);

		this.bar = this.parent.paper.rect(this.x + (this.w-this.barw)/2, this.y, this.barw, this.barh + this.slideh)
			.attr({fill:this.stroke, stroke:this.stroke})
			.click(function(e) {
				console.log('bar click:', e);
			})
			.drag(this.dragMove, this.dragStart, this.dragEnd, this, this, this);

		this.slide = this.parent.paper.rect(this.x + (this.w - this.slidew)/2, this.slideYPos(), this.slidew, this.slideh, 5)
			.attr({fill:this.stroke, stroke:this.stroke, 'stroke-width': this['stroke-width']})
			.drag(this.slideMove, this.slideStart, this.slideEnd, this, this, this);

		this.label = this.parent.paper.text(this.x + (this.w/2), this.y + this.h + this.slideh + this.fontsize*2, this.text)
			.attr({fill:this.stroke, stroke:this.stroke, 'font-size': this.fontsize})
			.drag(this.dragMove, this.dragStart, this.dragEnd, this, this, this);

		this.readout = this.parent.paper.text(this.x + (this.w/2), this.y + this.h + this.slideh + this.fontsize, ''+this.value)
			.attr({fill:this.stroke, stroke:this.stroke, 'font-size': this.fontsize-2})
			.drag(this.dragMove, this.dragStart, this.dragEnd, this, this, this);

		return this;
	},

	attr: function(attrs) {
		this.outerrect.attr(attrs);
		this.bar.attr(attrs);
		this.slide.attr(attrs);
		this.label.attr(attrs);
		this.readout.attr(attrs);
	},

	dragStart: function(x, y, event) {
console.log('Drag start:', x, y, event);
		if (!this.parent.editing) return true;
		this.drag = {x:this.x, y:this.y, xoff: x-this.x, yoff: y-this.y};
		this.dragging = true;
		this.outerrect.attr({fill:this.fill_highlight}).toFront();
		this.bar.toFront();
		this.slide.toFront();
		this.label.toFront();
		this.readout.toFront();
	},

	dragMove: function(dx, dy, x, y, e) {
		console.log('move:',dx,dy,x,y,e);
		this.x = this.drag.x + dx;
		this.y = this.drag.y + dy;

		this.outerrect.attr({x:x-this.drag.xoff, y:y-this.drag.yoff});
		this.bar.attr({x:x-this.drag.xoff + (this.w-this.barw)/2, y:y-this.drag.yoff});
		this.slide.attr({x:x-this.drag.xoff + (this.w - this.slidew)/2, y:this.slideYPos()});

		this.label.attr({x:x - this.drag.xoff + this.w/2, y:y - this.drag.yoff + this.h + this.slideh + this.fontsize*2});
		this.readout.attr({x:x - this.drag.xoff + this.w/2, y:y - this.drag.yoff + this.h + this.slideh + this.fontsize});
		return this.dragFinish(e);
	},

	dragEnd: function(e) {
		this.outerrect.attr({fill:this.fill});
		//this.bar.attr({fill:this.fill});
		//this.label.attr({fill:this.fill});
		//this.readout.attr({fill:this.fill});
		delete this.drag;
		this.dragging = false;
		return this.dragFinish(e);
	},
	
	dragFinish: function(e) {
		e.preventDefault();
		e.stopPropagation();
		return false;
	},


	slideStart: function(x, y, event) {
		this.sliding = true;
		this.slide.attr({fill:this.fill_highlight});
	},

	slideMove: function(dx, dy, x, y, e) {
		//console.log('move:',dx,dy,x,y,e)
		if (y < this.y) y = this.y;
		else if (y > this.y + this.h) y = this.y + this.h;
		var fraction = (y - this.y) / this.h;
		var value = Math.floor(this.min + (1.0 - fraction) * (this.max - this.min));
		this.setValue(value);
		return this.slideFinish(e);
	},

	slideEnd: function(e) {
		this.slide.attr({fill:this.stroke});
		return this.slideFinish(e);
	},
	
	slideFinish: function(e) {
		e.preventDefault();
		e.stopPropagation();
		this.sliding = false;
		this.exec();
		return false;
	},

	exec: function() {
		if (!this.script) return;
		var cmd = Mustache.render(this.script, this);
		console.log('button exec:', cmd);

		if (cmd.match(/^javascript\:/)) {			// javascript command
			cmd = cmd.replace('javascript:', '');
			eval(cmd);
		}
		else {										// bitlash command
			var self = this;
			reply_handler = function(reply) { self.handleReply.call(self, reply); };
			this.parent.sendCommand('exec', {'cmd': cmd, 'id':this.id}, reply_handler);
		}
	},

	slideYPos: function() {
		if (this.value < this.min) this.value = this.min;
		if (this.value > this.max) this.value = this.max;
		var fraction = (this.value - this.min) / (this.max - this.min);
		return Math.floor(this.y + this.h * (1.0 - fraction));
	},

//	handleReply: function(reply) {		// reply is ignored for slider
//		this.parent.sendUpdate('update', {id: this.id, value: this.value});
//	},

	setValue: function(value) {
		if (this.dragging) return;	// be the boss: ignore updates while dragging
		this.value = value;
		this.readout.attr({text: ''+this.value});
		var slidey = this.slideYPos();
		this.slide.attr({y:slidey});
		var update = {id: this.id, value: this.value};
		this.fire('update', update);
	},

	on: function(eventname, listener) {
		if (!this.listeners[eventname]) this.listeners[eventname] = [];
		this.listeners[eventname].push(listener);
	},

	fire: function(eventname, data) {
		var listeners = this.listeners[eventname];
		if (!listeners) return;
		for (var i=0; i<listeners.length; i++) {
			var func = listeners[i];
			func(data);
		}
	}	
}


//////////
//
//	Chart control
//
function Chart(options) {
	return this.init(options || {});
}

Chart.prototype = {

	init: function(options) {
		this.parent = options.parent;
		this.id = options.id || 'Chart' + this.parent.next_id++;
		if (this.parent.channel.length) this.id = '' + this.parent.channel + '.' + this.id;
		this.x = this.parent.x + (options.x || 50);
		this.y = this.parent.y + (options.y || 50);
		this.w = options.w || 300;
		this.h = options.h || 150;
		this.text = options.text || 'Untitled';
		this.script = options.script || '';
		this.fill = options.fill || 'black';
		this.fill_highlight = options.fill_highlight || 'white';
		this.stroke = options.stroke || this.parent.color;
		this['stroke-width'] = options['stroke-width'] || this.parent.control_stroke;
		this.fontsize = options.fontsize || 20;
		this.repeat = options.repeat || 0;
		this.running = 0;
		this.corner = options.corner || this.parent.Chart_corner;
		this.shape = options.shape || '';	// default to rectangle
		this.r = options.r || this.w/2;
		this.autorun = options.autorun || false;
		this.interpolate = options.interpolate || 'step-after';		// 'basis'

		this.listeners = {};	// hash of arrays of listeners, keyed by eventname

		this.ticks = options.ticks || 5;
		this.target = options.target || this.id;
		this.refresh = options.refresh || 0;
		if (options.ymax) this.ymax = options.ymax;
		if (options.ymin) this.ymin = options.ymin;
		this.render();		// render D3 chart
		
		var self = this;
		if (this.refresh) setInterval(function() { self.redraw.call(self); }, this.refresh);
		return this;
	},
	
	render: function() {

		var margin = {top: 0, right: 0, bottom: 0, left: 0};
		var width = this.w - margin.left - margin.right;
		var height = this.h - margin.top - margin.bottom;

		var x = d3.scale.linear().range([0, width]);
		var y = d3.scale.linear().range([height, 0]);
		var color = d3.scale.category10();
		var xAxis = d3.svg.axis().scale(x).ticks(this.ticks).orient('bottom');
		var yAxis = d3.svg.axis().scale(y).ticks(this.ticks).orient('left');

		var line = d3.svg.line().interpolate(this.interpolate)
				.x(function(d) { return x(d.time); })
				.y(function(d) { return y(d.value); });

		var self = this;
		this.outerrect = this.parent.paper.rect(this.x, this.y, this.w, this.h, this.parent.button_corner)
			.attr({fill: this.fill, stroke: this.stroke, 'stroke-width':this.parent.control_stroke})
			.click(function() { self.redraw(); })
			.drag(this.dragMove, this.dragStart, this.dragEnd, this, this, this);

		this.label = this.parent.paper.text(this.x + (this.w/2), this.y + this.h + this.fontsize*2, this.text)
			.attr({fill:this.stroke, stroke:this.stroke, 'font-size': this.fontsize})
			.click(function() { self.redraw(); })
			.drag(this.dragMove, this.dragStart, this.dragEnd, this, this, this);

		this.svg = d3.select(this.parent.paper.canvas).append('g')
				.attr('width', width + margin.left + margin.right)
				.attr('height', height + margin.top + margin.bottom)
			.append('g')
				.attr('transform', 'translate(' + (this.x+margin.left) + ',' + (this.y+margin.top) + ')');

		d3.json('d3/' + this.target, function(data) {

			// console.log('d3:', typeof data, data);

			color.domain(d3.keys(data[0]).filter(function(key) { return key !== 'time'; }));
			var values = color.domain().map(function(name) {
				return {
					name: name,
					values: data.map(function(d) {
						return {time: d.time, value: +d[name]};
					})
				};
			});
		
			x.domain(d3.extent(data, function(d) { return d.time; }));
			if (self.ymax != undefined) y.domain([self.ymin, self.ymax]);
			else y.domain([
				d3.min(values, function(c) { return d3.min(c.values, function(v) { return v.value; }); }),
				d3.max(values, function(c) { return d3.max(c.values, function(v) { return v.value; }); })
			]);
		
			self.svg.append('g')
					.attr('class', 'x axis')
					.attr('transform', 'translate(0,' + height + ')')
					.attr('stroke', self.stroke)
					.attr('fill', self.stroke)
					.call(xAxis);
		
			self.svg.append('g')
					.attr('class', 'y axis')
					.attr('stroke', self.stroke)
					.attr('fill', self.stroke)
					.call(yAxis)
/* y axis label
				.append('text')
					.attr('transform', 'rotate(-90)')
					.attr('y', 6)
					.attr('dy', '.71em')
					.style('text-anchor', 'end')
					.attr('stroke', self.stroke)
					.attr('fill', self.stroke)
					.text(' ');
*/		
			var value = self.svg.selectAll('.value')
					.data(values)
				.enter().append('g')
					.attr('class', 'value');
		
			value.append('path')
					.attr('class', 'line')
					.attr('d', function(d) { return line(d.values); })
					.style('stroke', function(d) { return color(d.name); })
					.style('stroke-width', self['stroke-width']);
		
			value.append('text')
					.datum(function(d) { return {name: d.name, value: d.values[d.values.length - 1]}; })
					.attr('transform', function(d) { return 'translate(' + x(d.value.time) + ',' + y(d.value.value) + ')'; })
					.attr('x', 3)
					.attr('dy', '.35em')
					.attr('stroke', self.stroke)
					.attr('fill', self.stroke)
					.text(function(d) { return d.name; });
		});
	},

	redraw: function() {
		if (this.svg) {
			var doomed_svg = this.svg;
			delete this.svg;
			this.render();
			doomed_svg.remove();
		}
	},

	dragStart: function(x, y, event) {
console.log('Drag start:', x, y, event);
		if (!this.parent.editing) return true;
		this.drag = {x:this.x, y:this.y, xoff: x-this.x, yoff: y-this.y};
		this.dragging = true;
		this.outerrect.attr({fill:this.fill_highlight}).toFront();
		this.label.toFront();
		this.svg.toFront();		
	},

	dragMove: function(dx, dy, x, y, e) {
		console.log('move:',dx,dy,x,y,e);
		this.outerrect.attr({x:x-this.drag.xoff, y:y-this.drag.yoff});
		this.label.attr({x:x - this.drag.xoff + this.w/2, y:y - this.drag.yoff + this.h + this.fontsize*2});
		this.svg.attr('x', x - this.drag.xoff);
		this.svg.attr('y', y - this.drag.yoff);
		return this.dragFinish(e);
	},

	dragEnd: function(e) {
		this.outerrect.attr({fill:this.fill});
		delete this.drag;
		this.dragging = false;
		return this.dragFinish(e);
	},
	
	dragFinish: function(e) {
		e.preventDefault();
		e.stopPropagation();
		return false;
	},

	handleClick: function(e) {
		if (this.repeat) {
			if (this.running) {
				this.running = false;
				clearInterval(this.intervalid);
				delete this.intervalid;
			} else {
				this.running = true;
				this.exec();
			}
		}
		else this.exec();

		if (e) {
			e.preventDefault();
			e.stopPropagation();
		}
		return false;
	},

	exec: function() {
		if (!this.script) {
			return;
		}
		var cmd = Mustache.render(this.script, this);
		console.log('Chart exec:', cmd);

		if (cmd.match(/^javascript\:/)) {			// javascript command
			cmd = cmd.replace('javascript:', '');
			eval(cmd);
		}
		else {										// bitlash command
			var self = this;
			var reply_handler = function(reply) { self.handleReply.call(self, reply); };
			this.parent.sendCommand('exec', {'cmd': cmd, 'id':this.id}, reply_handler);
		}

		if (this.repeat && !this.intervalid) {
			var self = this;
			this.intervalid = setInterval(function() { self.exec.call(self, {}); }, this.repeat);
		}
	},

/*
	handleReply: function(reply) {
		console.log("UNEXPECTED REPLY");
		if (reply === undefined) return;
		this.reply = reply.trim();
		if (this.reply.length == 0) return;
		this.setValue(this.reply);
		var update = {id: this.id, value: this.value};
		this.parent.sendUpdate('update', update);
		this.fire('update', update);
	},
*/
	
	setValue: function(value) {
		this.value = value;
		//this.label.attr({text: this.text + ': ' + this.value});
		var update = {id: this.id, value: this.value};
		this.fire('update', update);
	},

	on: function(eventname, listener) {
		if (!this.listeners[eventname]) this.listeners[eventname] = [];
		this.listeners[eventname].push(listener);
		//console.log('On:', this.id, this.listeners.length, this.listeners);
	},

	fire: function(eventname, data) {
		var listeners = this.listeners[eventname];
		//console.log('listeners:', listeners);
		if (!listeners) return;
		for (var i=0; i<listeners.length; i++) {
			var func = listeners[i];
			//console.log('firing listener', i, data);
			func(data);
		}
	}	
}
