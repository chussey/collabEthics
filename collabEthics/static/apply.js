
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
