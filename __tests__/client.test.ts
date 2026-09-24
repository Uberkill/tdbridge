import WebSocket, { Server } from 'ws';

describe('TDBridge Client-Server Interaction', () => {
    let wss: Server;
    let clientSocket: WebSocket;
    
    beforeAll((done) => {
        // Spin up a mock WebSocket server on a random port
        wss = new Server({ port: 8081 });
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
        clientSocket = new WebSocket('ws://localhost:8081') as any;
        
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

        clientSocket = new WebSocket('ws://localhost:8081') as any;
        
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
