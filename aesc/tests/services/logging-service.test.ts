import { describe, test, expect, beforeEach } from 'bun:test';
import { spyOn } from 'bun:test';
import { LoggingServiceImpl } from '../../src/generated/logging.service.impl';
import { LogLevel } from '../../src/types';

describe('LoggingService', () => {
    let service: LoggingServiceImpl;

    beforeEach(() => {
        service = new LoggingServiceImpl();
        // The logger is a singleton, so we must clear its state before each test.
        service.clearLogs();
    });

    test('info() should call console.log', () => {
        const logSpy = spyOn(console, 'log').mockImplementation(() => {});
        service.info('Test info message');
        expect(logSpy).toHaveBeenCalled();
        expect(logSpy.mock.calls[0][0]).toInclude('Test info message');
        logSpy.mockRestore();
    });

    test('warn() should call console.warn', () => {
        const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
        service.warn('Test warn message');
        expect(warnSpy).toHaveBeenCalled();
        expect(warnSpy.mock.calls[0][0]).toInclude('Test warn message');
        warnSpy.mockRestore();
    });

    test('error() should call console.error', () => {
        const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
        service.error('Test error message');
        expect(errorSpy).toHaveBeenCalled();
        expect(errorSpy.mock.calls[0][0]).toInclude('Test error message');
        errorSpy.mockRestore();
    });

    test('setLevel() should filter logs below the set level', () => {
        const logSpy = spyOn(console, 'log').mockImplementation(() => {});
        const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
        
        service.setLevel(LogLevel.WARN);

        service.info('This should not be logged');
        service.warn('This should be logged');

        expect(logSpy).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();

        logSpy.mockRestore();
        warnSpy.mockRestore();
    });

    test('getLogs() should return all recorded log entries', () => {
        service.setLevel(LogLevel.VERBOSE); // Ensure all levels are logged for this test
        service.info('First entry');
        service.error('Second entry');

        const logs = service.getLogs();
        expect(logs).toHaveLength(2);
        expect(logs[0].message).toBe('First entry');
        expect(logs[1].level).toBe(LogLevel.ERROR);
    });

    test('clearLogs() should clear the internal log array', () => {
        service.info('An entry');
        let logs = service.getLogs();
        expect(logs).toHaveLength(1);

        service.clearLogs();
        logs = service.getLogs();
        expect(logs).toHaveLength(0);
    });
});
