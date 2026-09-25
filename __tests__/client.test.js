"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importStar(require("ws"));
describe('TDBridge Client-Server Interaction', () => {
    let wss;
    let clientSocket;
    beforeAll((done) => {
        // Spin up a mock WebSocket server on a random port
        wss = new ws_1.Server({ port: 8081 });
        wss.on('listening', done);
    });
    afterAll((done) => {
        wss.close(done);
    });
    afterEach(() => {
        if (clientSocket) {
            clientSocket.close();
        }
    });
    test('should reject invalid room code', (done) => {
        wss.once('connection', (ws) => {
            ws.on('message', (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === 'join' && data.room !== 'VALID_CODE') {
                    ws.send(JSON.stringify({ type: 'rejected', reason: 'Invalid Code' }));
                    ws.close(1008);
                }
            });
        });
        // Mock the client connection
        clientSocket = new ws_1.default('ws://localhost:8081');
        clientSocket.onopen = () => {
            clientSocket.send(JSON.stringify({ type: 'join', room: 'BAD_CODE', name: 'Tester' }));
        };
        clientSocket.onmessage = (event) => {
            const data = JSON.parse(event.data.toString());
            expect(data.type).toBe('rejected');
            expect(data.reason).toBe('Invalid Code');
        };
        clientSocket.onclose = (event) => {
            expect(event.code).toBe(1008);
            done();
        };
    });
    test('should assign slot for valid room code', (done) => {
        wss.once('connection', (ws) => {
            ws.on('message', (msg) => {
                const data = JSON.parse(msg.toString());
                if (data.type === 'join' && data.room === 'VALID_CODE') {
                    ws.send(JSON.stringify({ type: 'assigned_slot', slot: 1 }));
                }
            });
        });
        clientSocket = new ws_1.default('ws://localhost:8081');
        clientSocket.onopen = () => {
            clientSocket.send(JSON.stringify({ type: 'join', room: 'VALID_CODE', name: 'Tester' }));
        };
        clientSocket.onmessage = (event) => {
            const data = JSON.parse(event.data.toString());
            expect(data.type).toBe('assigned_slot');
            expect(data.slot).toBe(1);
            done();
        };
    });
});
