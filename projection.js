isPowerOfTwo = function(x) {
    return (x & (x - 1)) == 0;
}


nextHighestPowerOfTwo = function(x) {
    --x;
    for (var i = 1; i < 32; i <<= 1) {
        x = x | x >> i;
    }
    return x + 1;
}

function Projection(new_parent_div) {
    this.parent_div = new_parent_div;
    this.init_image_url = "";

    // The control points which represent the top-left, top-right and bottom
    // right of the image. These will be wires, via d3.js, to the handles
    // in the svg element.
    this.controlPoints = [{
        x: 100,
        y: 100
    }, {
        x: 400,
        y: 100
    }, {
        x: 100,
        y: 400
    }, {
        x: 400,
        y: 400
    }];

    // The normalised texture co-ordinates of the quad in the screen image.
    this.srcPoints = "";

    // Reflect any changes in quality options

    this.screenCanvasElement = document.createElement('canvas');
    this.screenCanvasElement.id = "projection";
    this.screenCanvasElement.width = window.innerWidth;
    this.screenCanvasElement.height = window.innerHeight;
    this.parent_div.appendChild(this.screenCanvasElement);

    // Wire in the control handles to dragging. Call 'redrawImg' when they change.
    this.controlHandlesElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.controlHandlesElement.id = "projection-corners";
    this.controlHandlesElement.style.width = window.innerWidth;
    this.controlHandlesElement.style.height = window.innerHeight;
    this.parent_div.appendChild(this.controlHandlesElement);
    this.setupControlHandles(this.controlHandlesElement, this.redrawImg.bind(this));

    // Create a WegGL context from the canvas which will have the screen image
    // rendered to it. NB: preserveDrawingBuffer is needed for rendering the
    // image for download. (Otherwise, the canvas appears to have nothing in
    // it.)

    glOpts = {
        antialias: true,
        depth: false,
        preserveDrawingBuffer: true
    };
    this.gl = this.screenCanvasElement.getContext('webgl', glOpts) ||
        screenCanvasElement.getContext('experimental-webgl', glOpts);
    if (!this.gl) {
        this.addError("Your browser doesn't seem to support WebGL.");
    }

    // See if we have the anisotropic filtering extension by trying to get
    // if from the WebGL implementation.
    this.anisoExt =
        this.gl.getExtension('EXT_texture_filter_anisotropic') ||
        this.gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
        this.gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');

    // If we failed, tell the user that their image will look like poo on a
    // stick.
    if (!this.anisoExt) {
        this.anisotropicFilteringElement.checked = false;
        this.anisotropicFilteringElement.disabled = true;
        this.addError("Your browser doesn't support anisotropic filtering. " +
            "Ordinary MIP mapping will be used.");
    }

    // Setup the GL context compiling the shader programs and returning the
    // attribute and uniform locations.
    this.glResources = this.setupGlContext();

    // This object will store the width and height of the screen image in
    // normalised texture co-ordinates in its 'w' and 'h' fields.
    this.screenTextureSize;

    // Create an element to hold the screen image and arracnge for loadScreenTexture
    // to be called when the image is loaded.
    this.screenImgElement = new Image();
    this.screenImgElement.crossOrigin = '';
    this.screenImgElement.onload = this.loadScreenTexture.bind(this);
    this.screenImgElement.src = this.init_image_url;
}


Projection.prototype.loadDifferentImage = function(new_src) {
    this.screenImgElement.src = new_src;
    this.loadScreenTexture();
}


Projection.prototype.setupGlContext = function() {
    // Store return values here
    var rv = {};

    // Vertex shader:
    var vertShaderSource = [
        'attribute vec2 aVertCoord;',
        'uniform mat4 uTransformMatrix;',
        'varying vec2 vTextureCoord;',
        'void main(void) {',
        '    vTextureCoord = aVertCoord;',
        '    gl_Position = uTransformMatrix * vec4(aVertCoord, 0.0, 1.0);',
        '}'
    ].join('\n');

    var vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
    this.gl.shaderSource(vertexShader, vertShaderSource);
    this.gl.compileShader(vertexShader);

    if (!this.gl.getShaderParameter(vertexShader, this.gl.COMPILE_STATUS)) {
        this.addError('Failed to compile vertex shader:' +
            this.gl.getShaderInfoLog(vertexShader));
    }

    // Fragment shader:
    var fragShaderSource = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'uniform sampler2D uSampler;',
        'void main(void)  {',
        '    gl_FragColor = texture2D(uSampler, vTextureCoord);',
        '}'
    ].join('\n');

    var fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    this.gl.shaderSource(fragmentShader, fragShaderSource);
    this.gl.compileShader(fragmentShader);

    if (!this.gl.getShaderParameter(fragmentShader, this.gl.COMPILE_STATUS)) {
        this.addError('Failed to compile fragment shader:' +
            this.gl.getShaderInfoLog(fragmentShader));
    }

    // Compile the program
    rv.shaderProgram = this.gl.createProgram();
    this.gl.attachShader(rv.shaderProgram, vertexShader);
    this.gl.attachShader(rv.shaderProgram, fragmentShader);
    this.gl.linkProgram(rv.shaderProgram);

    if (!this.gl.getProgramParameter(rv.shaderProgram, this.gl.LINK_STATUS)) {
        this.addError('Shader linking failed.');
    }

    // Create a buffer to hold the vertices
    rv.vertexBuffer = this.gl.createBuffer();

    // Find and set up the uniforms and attributes        
    this.gl.useProgram(rv.shaderProgram);
    rv.vertAttrib = this.gl.getAttribLocation(rv.shaderProgram, 'aVertCoord');

    rv.transMatUniform = this.gl.getUniformLocation(rv.shaderProgram, 'uTransformMatrix');
    rv.samplerUniform = this.gl.getUniformLocation(rv.shaderProgram, 'uSampler');

    // Create a texture to use for the screen image
    rv.screenTexture = this.gl.createTexture();

    return rv;
}

Projection.prototype.loadScreenTexture = function() {
    if (!this.gl || !this.glResources) {
        return;
    }

    var image = this.screenImgElement;
    var extent = {
        w: image.naturalWidth,
        h: image.naturalHeight
    };
    //console.log(image);

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.glResources.screenTexture);

    // Scale up the texture to the next highest power of two dimensions.
    var canvas = document.createElement("canvas");
    canvas.width = nextHighestPowerOfTwo(extent.w);
    canvas.height = nextHighestPowerOfTwo(extent.h);

    var ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, image.width, image.height);
    //console.log(canvas)
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, canvas);


    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

    if (this.anisoExt) {
        // turn the anisotropy knob all the way to 11 (or down to 1 if it is
        // switched off).
        var maxAniso = this.gl.getParameter(this.anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        this.gl.texParameterf(this.gl.TEXTURE_2D, this.anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
    }

    this.gl.generateMipmap(this.gl.TEXTURE_2D);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);

    // Record normalised height and width.
    var w = extent.w / canvas.width,
        h = extent.h / canvas.height;

    this.srcPoints = [{
            x: 0,
            y: 0
        }, // top-left
        {
            x: w,
            y: 0
        }, // top-right
        {
            x: 0,
            y: h
        }, // bottom-left
        {
            x: w,
            y: h
        } // bottom-right
    ];

    // setup the vertex buffer with the source points
    var vertices = [];
    for (var i = 0; i < this.srcPoints.length; i++) {
        vertices.push(this.srcPoints[i].x);
        vertices.push(this.srcPoints[i].y);
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.glResources.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);

    // Redraw the image
    this.redrawImg();
}

Projection.prototype.clear = function() {
    // set background to full transparency
    var vpW = this.screenCanvasElement.width;
    var vpH = this.screenCanvasElement.height;
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.viewport(0, 0, vpW, vpH);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
}

Projection.prototype.redrawImg = function() {
    if (!this.gl || !this.glResources || !this.srcPoints) {
        return;
    }

    var vpW = this.screenCanvasElement.width;
    var vpH = this.screenCanvasElement.height;

    // Find where the control points are in 'window coordinates'. I.e.
    // where thecanvas covers [-1,1] x [-1,1]. Note that we have to flip
    // the y-coord.
    var dstPoints = [];
    for (var i = 0; i < this.controlPoints.length; i++) {
        dstPoints.push({
            x: (2 * this.controlPoints[i].x / vpW) - 1,
            y: -(2 * this.controlPoints[i].y / vpH) + 1
        });
    }

    // Get the transform
    var v = this.transformationFromQuadCorners(this.srcPoints, dstPoints);

    // set background to full transparency
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.viewport(0, 0, vpW, vpH);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    this.gl.useProgram(this.glResources.shaderProgram);

    // draw the triangles
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.glResources.vertexBuffer);
    this.gl.enableVertexAttribArray(this.glResources.vertAttrib);
    this.gl.vertexAttribPointer(this.glResources.vertAttrib, 2, this.gl.FLOAT, false, 0, 0);

    /*  If 'v' is the vector of transform coefficients, we want to use
        the following matrix:

        [v[0], v[3],   0, v[6]],
        [v[1], v[4],   0, v[7]],
        [   0,    0,   1,    0],
        [v[2], v[5],   0,    1]

        which must be unravelled and sent to uniformMatrix4fv() in *column-major*
        order. Hence the mystical ordering of the array below.
     */
    this.gl.uniformMatrix4fv(
        this.glResources.transMatUniform,
        false, [
            v[0], v[1], 0, v[2],
            v[3], v[4], 0, v[5],
            0, 0, 0, 0,
            v[6], v[7], 0, 1
        ]);

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.glResources.screenTexture);
    this.gl.uniform1i(this.glResources.samplerUniform, 0);

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
}

Projection.prototype.transformationFromQuadCorners = function(before, after) {
    /*
       Return the 8 elements of the transformation matrix which maps
       the points in *before* to corresponding ones in *after*. The
       points should be specified as
       [{x:x1,y:y1}, {x:x2,y:y2}, {x:x3,y:y2}, {x:x4,y:y4}].

  Note: There are 8 elements because the bottom-right element is
  assumed to be '1'.
     */

    var b = numeric.transpose([
        [
            after[0].x, after[0].y,
            after[1].x, after[1].y,
            after[2].x, after[2].y,
            after[3].x, after[3].y
        ]
    ]);

    var A = [];
    for (var i = 0; i < before.length; i++) {
        A.push([
            before[i].x, 0, -after[i].x * before[i].x,
            before[i].y, 0, -after[i].x * before[i].y, 1, 0
        ]);
        A.push([
            0, before[i].x, -after[i].y * before[i].x,
            0, before[i].y, -after[i].y * before[i].y, 0, 1
        ]);
    }

    // Solve for T and return the elements as a single array
    return numeric.transpose(numeric.dot(numeric.inv(A), b))[0];
}


Projection.prototype.setupControlHandles = function(controlHandlesElement, onChangeCallback) {
    // Use d3.js to provide user-draggable control points
    this.rectDragBehav = d3.behavior.drag()
        .on('drag', function(d, i) {
            d.x += d3.event.dx;
            d.y += d3.event.dy;
            d3.select(this).attr('cx', d.x).attr('cy', d.y);
            onChangeCallback();
        });

    this.dragT = d3.select(controlHandlesElement).selectAll('circle')
        .data(this.controlPoints)
        .enter().append('circle')
        .attr('cx', function(d) {
            return d.x;
        })
        .attr('cy', function(d) {
            return d.y;
        })
        .attr('fill', 'white')
        .attr('stroke', 'grey')
        .attr('r', 15)
        .attr('class', 'control-point')
        .call(this.rectDragBehav);
}

Projection.prototype.addError = function(message) {
    console.log(message);
}

Projection.prototype.saveResult = function() {
    var resultCanvas = document.createElement('canvas');
    resultCanvas.width = screenCanvasElement.width;
    resultCanvas.height = screenCanvasElement.height;
    var ctx = resultCanvas.getContext('2d');

    var bgImage = new Image();
    bgImage.crossOrigin = '';
    bgImage.onload = function() {
        ctx.drawImage(bgImage, 0, 0);
        ctx.drawImage(screenCanvasElement, 0, 0);
        Canvas2Image.saveAsPNG(resultCanvas);
    }
    bgImage.src = document.getElementById('background').src;
}


map1 = new Projection(document.getElementById('container'));
