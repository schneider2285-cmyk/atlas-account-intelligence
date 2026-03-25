import { describe, it, expect } from 'vitest';
import { genericHtmlParser } from '../parsers/generic-html';

const scheduleTable = `
<html><body>
<table>
  <tr><th>Time</th><th>Monday</th><th>Tuesday</th><th>Wednesday</th><th>Thursday</th><th>Friday</th><th>Saturday</th></tr>
  <tr><td>6:00 AM</td><td>Fundamentals</td><td>No-Gi</td><td>Fundamentals</td><td>No-Gi</td><td>Fundamentals</td><td>Open Mat 10:00 am - 12:00 pm</td></tr>
  <tr><td>12:00 PM</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
</table>
</body></html>
`;

describe('genericHtmlParser.detect', () => {
  it('detects schedule tables with day headers', () => {
    const result = genericHtmlParser.detect(scheduleTable);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe(0.5);
  });

  it('does not detect from plain HTML', () => {
    const result = genericHtmlParser.detect('<html><body><p>No schedule</p></body></html>');
    expect(result.detected).toBe(false);
  });
});

describe('genericHtmlParser.extract', () => {
  it('extracts open mat from table cell', () => {
    const results = genericHtmlParser.extract(scheduleTable);
    expect(results.length).toBe(1);
    expect(results[0].dayOfWeek).toBe(6); // Saturday
    expect(results[0].startTime).toBe('10:00');
    expect(results[0].endTime).toBe('12:00');
  });

  it('skips cells without open mat keywords', () => {
    const noOpenMat = `
    <html><body>
    <table>
      <tr><th>Monday</th><th>Tuesday</th><th>Wednesday</th><th>Thursday</th></tr>
      <tr><td>Fundamentals 6:00 - 7:00 am</td><td>No-Gi 6:00 - 7:00 am</td><td>Drilling 6:00 - 7:00 am</td><td>Competition 6:00 - 7:00 am</td></tr>
    </table>
    </body></html>`;
    const results = genericHtmlParser.extract(noOpenMat);
    expect(results).toEqual([]);
  });

  it('skips cells with no parseable time', () => {
    const noTime = `
    <html><body>
    <table>
      <tr><th>Monday</th><th>Tuesday</th><th>Wednesday</th><th>Saturday</th></tr>
      <tr><td>Class</td><td>Class</td><td>Class</td><td>Open Mat TBD</td></tr>
    </table>
    </body></html>`;
    const results = genericHtmlParser.extract(noTime);
    expect(results).toEqual([]);
  });
});
