// https://github.com/josephg/ShareJS/blob/master/lib/client/textarea.js

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

//I do not claim this work.

/* This contains the textarea binding for ShareDB. This binding is really
 * simple, and a bit slow on big texuments (Its O(N). However, it requires no
 * changes to the DOM and no heavy libraries like ace. It works for any kind of
 * text input field.
 *
 * You probably want to use this binding for small fields on forms and such.
 * For code editors or rich text editors or whatever, I recommend something
 * heavier.
 */

 /* docChange creates the edits to convert oldval -> newval.
  *
  * This function should be called every time the text element is changed.
  * Because changes are always localised, the diffing is quite easy. We simply
  * scan in from the start and scan in from the end to isolate the edited range,
  * then delete everything that was removed & add everything that was added.
  * This wouldn't work for complex changes, but this function should be called
  * on keystroke - so the edits will mostly just be single character changes.
  * Sometimes they'll paste text over other text, but even then the diff
  * generated by this algorithm is correct.
  *
  * This algorithm is O(N). I suspect you could speed it up somehow using regular expressions.
  */

  var docChange = function (doc, prev, next) {
    console.log('docChange', doc, prev, next);

    if (prev === next) return;
    var initialStart = 0;
    while (prev.charAt(initialStart) === next.charAt(initialStart)) {
      initialStart++;
    }
    var initialEnd = 0;
    while (prev.charAt(prev.length - 1 - initialEnd) === next.charAt(next.length - 1 - initialEnd) &&
        initialEnd + initialStart < prev.length && initialEnd + initialStart < next.length) {
      initialEnd++;
    }
    if (prev.length !== initialStart + initialEnd) {
      console.log('remove op');
      var operation = [initialStart, '', {
        d: prev.length - initialStart - initialEnd
      }];
      console.log(operation);
      doc.submitOp(operation);
    }

    if (next.length !== initialStart + initialEnd) {
      doc.submitOp([initialStart, next.slice(initialStart, next.length - initialEnd)]);
    }
  };


// Attach a textarea to a document's editing context.
//
// The context is optional, and will be created from the document if its not
// specified.
var attachTextarea = function (elem, doc) {
  // if (!doc) doc = this.createContext();
  // if (!doc.provides.text) throw new Error('Cannot attach to non-text document');

  elem.value = doc.data;

  // The current value of the element's text is stored so we can quickly check
  // if its been changed in the event handlers. This is mostly for browsers on
  // windows, where the content contains \r\n newlines. applyChange() is only
  // called after the \r\n newlines are converted, and that check is quite
  // slow. So we also cache the string before conversion so we can do a quick
  // check incase the conversion isn't needed.
  var prevvalue;

  // Replace the content of the text area with newText, and transform the
  // current cursor by the specified function.
  var replaceText = function (newText, transformCursor) {
    console.log('replaceText', newText);
    if (transformCursor) {
      var newSelection = [transformCursor(elem.selectionStart), transformCursor(elem.selectionEnd)];
    }

    // Fixate the window's scroll while we set the element's value. Otherwise
    // the browser scrolls to the element.
    var scrollTop = elem.scrollTop;
    elem.value = newText;
    prevvalue = elem.value; // Not done on one line so the browser can do newline conversion.
    if (elem.scrollTop !== scrollTop) elem.scrollTop = scrollTop;

    // Setting the selection moves the cursor. We'll just have to let your
    // cursor drift if the element isn't active, though usually users don't
    // care.
    if (newSelection && window.document.activeElement === elem) {
      elem.selectionStart = newSelection[0];
      elem.selectionEnd = newSelection[1];
    }
  };

  replaceText(doc.data);

  // *** remote -> local changes

  var onInsert = function (pos, text) {
    console.log('onInsert', pos, text);
    var transformCursor = function (cursor) {
      return pos < cursor ? cursor + text.length : cursor;
    };

    // Remove any window-style newline characters. Windows inserts these, and
    // they mess up the generated diff.
    var prev = elem.value.replace(/\r\n/g, '\n');
    replaceText(prev.slice(0, pos) + text + prev.slice(pos), transformCursor);
  };


  var onRemove = function (pos, length) {
    console.log('onRemove', pos, length);

    var transformCursor = function (cursor) {
      // If the cursor is inside the deleted region, we only want to move back to the start
      // of the region. Hence the Math.min.
      return pos < cursor ? cursor - Math.min(length, cursor - pos) : cursor;
    };

    var prev = elem.value.replace(/\r\n/g, '\n');
    replaceText(prev.slice(0, pos) + prev.slice(pos + length), transformCursor);
  };

  var _updateField = function(fields, value) {
    if (typeof value === 'number') {
      fields.pos = value;
    } else if (typeof value === 'string') {
      fields.insertStr = value;
    } else if (typeof value === 'object' && value.d !== undefined) {
      fields.delNum = value.d;
    }
  }

  doc.on('op', function (op, localContext) {
    console.log('on op', op, localContext);
    if (localContext === true) {
      return;
    }
    var fields = {pos: 0, insertStr: '', delNum: 0};

    for (var i = 0; i < op.length; i++) {
      _updateField(fields, op[i]);
    }

    // console.log(fields);
    if (fields.insertStr.length > 0) {
      // insert
      onInsert(fields.pos, fields.insertStr);
    }
    if (fields.delNum > 0) {
      // delete
      onRemove(fields.pos, fields.delNum);
    }
  });




  // *** local -> remote changes

  // This function generates operations from the changed content in the textarea.
  var genOp = function (event) {
    // In a timeout so the browser has time to propogate the event's changes to the DOM.
    setTimeout(function () {
      if (elem.value !== prevvalue) {
        prevvalue = elem.value;
        docChange(doc, doc.data, elem.value.replace(/\r\n/g, '\n'));
      }
    }, 0);
  };

  var eventNames = ['textInput', 'keydown', 'keyup', 'select', 'cut', 'paste'];
  for (var i = 0; i < eventNames.length; i++) {
    var e = eventNames[i];
    if (elem.addEventListener) {
      elem.addEventListener(e, genOp, false);
    } else {
      elem.attachEvent('on' + e, genOp);
    }
  }

  doc.detach = function () {
    for (var i = 0; i < eventNames.length; i++) {
      var e = eventNames[i];
      if (elem.removeEventListener) {
        elem.removeEventListener(e, genOp, false);
      } else {
        elem.detachEvent('on' + e, genOp);
      }
    }
  };

  return doc;
};
