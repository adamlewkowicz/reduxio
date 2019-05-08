const reduxIoMiddleware = require('../dist/index').default;
const io = require('socket.io-client');
const http = require('http');
const ioBack = require('socket.io');
const { createStore, applyMiddleware } = require('redux');
const { chatReducer, createStoreWithMiddleware } = require('../__mocks__/store');
const { wait,  } = require('./__utils__');

let socket;
let httpServer;
let httpServerAddr;
let ioServer;

let serverSocket;

beforeAll((done) => {
  httpServer = http.createServer().listen();
  httpServerAddr = httpServer.address();
  ioServer = ioBack(httpServer);
  done();
});

afterAll((done) => {
  ioServer.close();
  httpServer.close();
  done();
});

beforeEach((done) => {
  // Square brackets are used for IPv6
  socket = io.connect(`http://[${httpServerAddr.address}]:${httpServerAddr.port}`, {
    'reconnection delay': 0,
    'reopen delay': 0,
    'force new connection': true,
    transports: ['websocket'],
  });
  ioServer.on('connection', (socket) => {
    serverSocket = socket;
    done();
  })
});

afterEach((done) => {
  if (socket.connected) {
    socket.disconnect();
  }
  done();
});


describe('Redux middleware', () => {
  it('emits event properly', (done) => {
    const clientEmit = jest.spyOn(socket, 'emit');

    const store = createStore(
      chatReducer,
      applyMiddleware(
        reduxIoMiddleware({ socket })
      )
    );

    const action = {
      type: 'SEND_MESSAGE',
      payload: 'test message',
      meta: { io: true }
    }

    serverSocket.on(action.type, (receivedAction, dispatch) => {
      expect(clientEmit).toHaveBeenCalledWith(action.type, action, expect.any(Function));
      expect(receivedAction).toStrictEqual(action);
      expect(dispatch).toStrictEqual(expect.any(Function));
      done();
    });

    store.dispatch(action);
  });

  it('dispatches action from server', (done) => {
    const store = createStoreWithMiddleware(
      reduxIoMiddleware({
        socket
      })
    );
    // const storeSubscription = jest.spyOn(store.subscribe);
    const unsubscribe = store.subscribe((a) => {
      console.log('CALLED ss', a)
    });

    const action = {
      type: 'SEND_MESSAGE',
      payload: 'test message',
      meta: { io: true }
    }

    serverSocket.on('SEND_MESSAGE', async (receivedAction, dispatch) => {
      dispatch({
        type: '$_RECEIVE_MESSAGE',
        payload: 'Message sent from server'
      });
      await wait();

      dispatch({
        type: '$_RECEIVE_MESSAGE',
        payload: 'Message sent from server'
      });

      await wait(500);

      done();
    });

    store.dispatch(action);

    unsubscribe();
  });
});