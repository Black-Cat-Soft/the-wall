import CoreBluetooth
import ExpoModulesCore

private struct WallPeerPayload: Codable {
  let userId: Int
  let username: String
  let sessionToken: String
}

private final class WallBleController: NSObject, CBCentralManagerDelegate, CBPeripheralManagerDelegate, CBPeripheralDelegate {
  private let serviceUUID = CBUUID(string: "74A6B2A1-4B8D-4A3B-9E51-6CB22E57A001")
  private let identityUUID = CBUUID(string: "74A6B2A1-4B8D-4A3B-9E51-6CB22E57A002")

  private var centralManager: CBCentralManager?
  private var peripheralManager: CBPeripheralManager?
  private var identityCharacteristic: CBMutableCharacteristic?
  private var activePeripheral: CBPeripheral?
  private var identityData = Data()
  private var currentUserId: Int?
  private var currentPeer: WallPeerPayload?
  private var lastRSSI: Int?
  private var rssiTimer: Timer?
  private var isRunning = false
  private let eventEmitter: (String, [String: Any?]) -> Void

  init(eventEmitter: @escaping (String, [String: Any?]) -> Void) {
    self.eventEmitter = eventEmitter
    super.init()
  }

  func start(userId: Int, username: String) {
    stop()

    let payload = WallPeerPayload(
      userId: userId,
      username: username,
      sessionToken: UUID().uuidString
    )

    guard let encoded = try? JSONEncoder().encode(payload) else {
      emitState("error", message: "Could not prepare the BLE identity.")
      return
    }

    currentUserId = userId
    identityData = encoded
    isRunning = true
    emitState("initializing")

    centralManager = CBCentralManager(delegate: self, queue: .main)
    peripheralManager = CBPeripheralManager(delegate: self, queue: .main)
  }

  func stop() {
    isRunning = false
    rssiTimer?.invalidate()
    rssiTimer = nil

    centralManager?.stopScan()
    if let peripheral = activePeripheral {
      centralManager?.cancelPeripheralConnection(peripheral)
    }

    peripheralManager?.stopAdvertising()
    peripheralManager?.removeAllServices()

    activePeripheral = nil
    currentPeer = nil
    lastRSSI = nil
    identityCharacteristic = nil
    centralManager = nil
    peripheralManager = nil
  }

  public func centralManagerDidUpdateState(_ central: CBCentralManager) {
    guard isRunning else { return }

    switch central.state {
    case .poweredOn:
      central.scanForPeripherals(
        withServices: [serviceUUID],
        options: [CBCentralManagerScanOptionAllowDuplicatesKey: false]
      )
      emitState("scanning")
    case .unauthorized:
      emitState("error", message: "Bluetooth permission is required to find nearby people.")
    case .unsupported:
      emitState("error", message: "Bluetooth Low Energy is not supported on this device.")
    case .poweredOff:
      emitState("error", message: "Turn on Bluetooth to bump someone nearby.")
    case .resetting:
      emitState("initializing", message: "Bluetooth is restarting…")
    case .unknown:
      emitState("initializing")
    @unknown default:
      emitState("error", message: "Bluetooth is unavailable.")
    }
  }

  public func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    guard isRunning else { return }

    switch peripheral.state {
    case .poweredOn:
      let characteristic = CBMutableCharacteristic(
        type: identityUUID,
        properties: [.read],
        value: identityData,
        permissions: [.readable]
      )
      let service = CBMutableService(type: serviceUUID, primary: true)
      service.characteristics = [characteristic]
      identityCharacteristic = characteristic
      peripheral.add(service)
    case .unauthorized:
      emitState("error", message: "Bluetooth permission is required to be discoverable.")
    case .unsupported:
      emitState("error", message: "This iPhone cannot advertise over Bluetooth Low Energy.")
    case .poweredOff:
      emitState("error", message: "Turn on Bluetooth to become discoverable.")
    case .resetting:
      emitState("initializing", message: "Bluetooth is restarting…")
    case .unknown:
      emitState("initializing")
    @unknown default:
      emitState("error", message: "Bluetooth advertising is unavailable.")
    }
  }

  public func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
    guard isRunning else { return }

    if let error {
      emitState("error", message: "Could not start Bluetooth advertising: \(error.localizedDescription)")
      return
    }

    peripheral.startAdvertising([
      CBAdvertisementDataServiceUUIDsKey: [serviceUUID],
      CBAdvertisementDataLocalNameKey: "The Wall"
    ])
  }

  public func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
    if let error {
      emitState("error", message: "Could not become discoverable: \(error.localizedDescription)")
    }
  }

  public func centralManager(
    _ central: CBCentralManager,
    didDiscover peripheral: CBPeripheral,
    advertisementData: [String: Any],
    rssi RSSI: NSNumber
  ) {
    guard isRunning, activePeripheral == nil else { return }

    lastRSSI = RSSI.intValue == 127 ? nil : RSSI.intValue
    activePeripheral = peripheral
    peripheral.delegate = self
    central.stopScan()
    emitState("connecting")
    central.connect(peripheral)
  }

  public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
    peripheral.discoverServices([serviceUUID])
  }

  public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
    resumeScanning(message: error?.localizedDescription)
  }

  public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
    guard isRunning, activePeripheral?.identifier == peripheral.identifier else { return }
    resumeScanning(message: error?.localizedDescription)
  }

  public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
    if let error {
      resumeScanning(message: error.localizedDescription)
      return
    }

    guard let service = peripheral.services?.first(where: { $0.uuid == serviceUUID }) else {
      resumeScanning(message: "The nearby device did not expose The Wall service.")
      return
    }

    peripheral.discoverCharacteristics([identityUUID], for: service)
  }

  public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
    if let error {
      resumeScanning(message: error.localizedDescription)
      return
    }

    guard let characteristic = service.characteristics?.first(where: { $0.uuid == identityUUID }) else {
      resumeScanning(message: "The nearby device did not share an identity.")
      return
    }

    peripheral.readValue(for: characteristic)
  }

  public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
    if let error {
      resumeScanning(message: error.localizedDescription)
      return
    }

    guard
      characteristic.uuid == identityUUID,
      let value = characteristic.value,
      let peer = try? JSONDecoder().decode(WallPeerPayload.self, from: value)
    else {
      resumeScanning(message: "The nearby identity was invalid.")
      return
    }

    guard peer.userId != currentUserId else {
      resumeScanning()
      return
    }

    currentPeer = peer
    emitPeer(peer, rssi: lastRSSI)
    emitState("found")
    startRSSIUpdates(for: peripheral)
  }

  public func peripheral(_ peripheral: CBPeripheral, didReadRSSI RSSI: NSNumber, error: Error?) {
    guard error == nil, let peer = currentPeer else { return }
    lastRSSI = RSSI.intValue == 127 ? nil : RSSI.intValue
    emitPeer(peer, rssi: lastRSSI)
  }

  private func startRSSIUpdates(for peripheral: CBPeripheral) {
    rssiTimer?.invalidate()
    rssiTimer = Timer.scheduledTimer(withTimeInterval: 0.75, repeats: true) { [weak peripheral] _ in
      peripheral?.readRSSI()
    }
  }

  private func resumeScanning(message: String? = nil) {
    rssiTimer?.invalidate()
    rssiTimer = nil
    currentPeer = nil
    lastRSSI = nil

    if let peripheral = activePeripheral {
      centralManager?.cancelPeripheralConnection(peripheral)
    }
    activePeripheral = nil

    guard isRunning, centralManager?.state == .poweredOn else { return }
    centralManager?.scanForPeripherals(
      withServices: [serviceUUID],
      options: [CBCentralManagerScanOptionAllowDuplicatesKey: false]
    )
    emitState("scanning", message: message)
  }

  private func emitState(_ state: String, message: String? = nil) {
    var payload: [String: Any?] = ["state": state]
    payload["message"] = message
    eventEmitter("onStateChanged", payload)
  }

  private func emitPeer(_ peer: WallPeerPayload, rssi: Int?) {
    var payload: [String: Any?] = [
      "userId": peer.userId,
      "username": peer.username,
      "sessionToken": peer.sessionToken
    ]
    payload["rssi"] = rssi
    eventEmitter("onPeerChanged", payload)
  }
}

public final class WallBleModule: Module {
  private lazy var controller = WallBleController { [weak self] eventName, payload in
    self?.sendEvent(eventName, payload)
  }

  public func definition() -> ModuleDefinition {
    Name("WallBle")

    Events("onStateChanged", "onPeerChanged")

    AsyncFunction("start") { (userId: Int, username: String) in
      DispatchQueue.main.async {
        self.controller.start(userId: userId, username: username)
      }
    }

    AsyncFunction("stop") {
      DispatchQueue.main.async {
        self.controller.stop()
      }
    }

    OnDestroy {
      DispatchQueue.main.async {
        self.controller.stop()
      }
    }
  }
}
