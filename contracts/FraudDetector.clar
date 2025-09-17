(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-RIDE-ID u101)
(define-constant ERR-INVALID-THRESHOLD u102)
(define-constant ERR-INVALID-MAX-DISTANCE u103)
(define-constant ERR-INVALID-MAX-SPEED u104)
(define-constant ERR-INVALID-DUPLICATE-TOLERANCE u105)
(define-constant ERR-RIDE-NOT-FOUND u106)
(define-constant ERR-ALREADY-FLAGGED u107)
(define-constant ERR-NOT-FLAGGED u108)
(define-constant ERR-INVALID-REASON u109)
(define-constant ERR-INVALID-FLAGGED-AT u110)
(define-constant ERR-INVALID-VEHICLE-TYPE u111)
(define-constant ERR-INVALID-GPS-DATA u112)
(define-constant ERR-INVALID-TIMESTAMP u113)
(define-constant ERR-INVALID-ORACLE u114)
(define-constant ERR-THRESHOLD-NOT-SET u115)
(define-constant ERR-INVALID-UPDATE-PARAM u116)
(define-constant ERR-MAX_FLAGS_EXCEEDED u117)
(define-constant ERR-INVALID-ANALYSIS-TYPE u118)
(define-constant ERR-INVALID-USER u119)
(define-constant ERR-INVALID-STATUS u120)

(define-data-var max-distance uint u1000000)
(define-data-var max-speed uint u200)
(define-data-var duplicate-tolerance uint u5)
(define-data-var flag-limit uint u1000)
(define-data-var oracle-principal principal tx-sender)
(define-data-var admin-principal principal tx-sender)
(define-data-var analysis-fee uint u10)
(define-data-var next-flag-id uint u0)

(define-map rides
  uint
  {
    user: principal,
    distance: uint,
    vehicle-type: (string-ascii 20),
    gps-start: (string-ascii 100),
    gps-end: (string-ascii 100),
    start-time: uint,
    end-time: uint,
    timestamp: uint
  }
)

(define-map flags
  uint
  {
    ride-id: uint,
    reason: (string-ascii 100),
    flagged-at: uint,
    status: bool
  }
)

(define-map flags-by-ride
  uint
  (list 10 uint)
)

(define-map analysis-history
  uint
  {
    ride-id: uint,
    analysis-type: (string-ascii 50),
    result: bool,
    timestamp: uint
  }
)

(define-read-only (get-ride (id uint))
  (map-get? rides id)
)

(define-read-only (get-flag (id uint))
  (map-get? flags id)
)

(define-read-only (get-flags-by-ride (ride-id uint))
  (map-get? flags-by-ride ride-id)
)

(define-read-only (get-analysis-history (id uint))
  (map-get? analysis-history id)
)

(define-read-only (get-max-distance)
  (var-get max-distance)
)

(define-read-only (get-max-speed)
  (var-get max-speed)
)

(define-read-only (get-duplicate-tolerance)
  (var-get duplicate-tolerance)
)

(define-read-only (get-oracle-principal)
  (var-get oracle-principal)
)

(define-private (validate-ride-id (id uint))
  (if (> id u0)
      (ok true)
      (err ERR-INVALID-RIDE-ID))
)

(define-private (validate-distance (dist uint))
  (if (> dist u0)
      (ok true)
      (err ERR-INVALID-MAX-DISTANCE))
)

(define-private (validate-speed (speed uint))
  (if (> speed u0)
      (ok true)
      (err ERR-INVALID-MAX-SPEED))
)

(define-private (validate-duplicate-tol (tol uint))
  (if (> tol u0)
      (ok true)
      (err ERR-INVALID-DUPLICATE-TOLERANCE))
)

(define-private (validate-reason (reason (string-ascii 100)))
  (if (> (len reason) u0)
      (ok true)
      (err ERR-INVALID-REASON))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-vehicle-type (vtype (string-ascii 20)))
  (if (or (is-eq vtype "EV") (is-eq vtype "bike") (is-eq vtype "transit"))
      (ok true)
      (err ERR-INVALID-VEHICLE-TYPE))
)

(define-private (validate-gps (gps (string-ascii 100)))
  (if (> (len gps) u0)
      (ok true)
      (err ERR-INVALID-GPS-DATA))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p tx-sender))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-private (validate-status (status bool))
  (ok true)
)

(define-private (is-oracle (caller principal))
  (is-eq caller (var-get oracle-principal))
)

(define-private (is-admin (caller principal))
  (is-eq caller (var-get admin-principal))
)

(define-public (set-max-distance (new-dist uint))
  (begin
    (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
    (try! (validate-distance new-dist))
    (var-set max-distance new-dist)
    (ok true)
  )
)

(define-public (set-max-speed (new-speed uint))
  (begin
    (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
    (try! (validate-speed new-speed))
    (var-set max-speed new-speed)
    (ok true)
  )
)

(define-public (set-duplicate-tolerance (new-tol uint))
  (begin
    (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
    (try! (validate-duplicate-tol new-tol))
    (var-set duplicate-tolerance new-tol)
    (ok true)
  )
)

(define-public (set-oracle-principal (new-oracle principal))
  (begin
    (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
    (try! (validate-principal new-oracle))
    (var-set oracle-principal new-oracle)
    (ok true)
  )
)

(define-public (set-analysis-fee (new-fee uint))
  (begin
    (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
    (var-set analysis-fee new-fee)
    (ok true)
  )
)

(define-public (submit-ride
  (distance uint)
  (vehicle-type (string-ascii 20))
  (gps-start (string-ascii 100))
  (gps-end (string-ascii 100))
  (start-time uint)
  (end-time uint)
)
  (let ((ride-id (var-get next-flag-id)))
    (try! (validate-distance distance))
    (try! (validate-vehicle-type vehicle-type))
    (try! (validate-gps gps-start))
    (try! (validate-gps gps-end))
    (try! (validate-timestamp start-time))
    (try! (validate-timestamp end-time))
    (asserts! (> end-time start-time) (err ERR-INVALID-TIMESTAMP))
    (map-set rides ride-id
      {
        user: tx-sender,
        distance: distance,
        vehicle-type: vehicle-type,
        gps-start: gps-start,
        gps-end: gps-end,
        start-time: start-time,
        end-time: end-time,
        timestamp: block-height
      }
    )
    (var-set next-flag-id (+ ride-id u1))
    (print { event: "ride-submitted", id: ride-id })
    (ok ride-id)
  )
)

(define-public (flag-ride (ride-id uint) (reason (string-ascii 100)))
  (let ((current-flags (default-to (list) (map-get? flags-by-ride ride-id))))
    (asserts! (is-oracle tx-sender) (err ERR-NOT-AUTHORIZED))
    (try! (validate-ride-id ride-id))
    (try! (validate-reason reason))
    (asserts! (is-some (map-get? rides ride-id)) (err ERR-RIDE-NOT-FOUND))
    (asserts! (< (len current-flags) (var-get flag-limit)) (err ERR-MAX_FLAGS_EXCEEDED))
    (let ((flag-id (var-get next-flag-id)))
      (map-set flags flag-id
        {
          ride-id: ride-id,
          reason: reason,
          flagged-at: block-height,
          status: true
        }
      )
      (map-set flags-by-ride ride-id (unwrap-panic (as-max-len? (append current-flags flag-id) u10)))
      (var-set next-flag-id (+ flag-id u1))
      (print { event: "ride-flagged", ride-id: ride-id, flag-id: flag-id })
      (ok flag-id)
    )
  )
)

(define-public (unflag-ride (flag-id uint))
  (let ((flag (map-get? flags flag-id)))
    (match flag
      f
        (begin
          (asserts! (is-admin tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (get status f) (err ERR-NOT-FLAGGED))
          (map-set flags flag-id (merge f { status: false }))
          (print { event: "ride-unflagged", flag-id: flag-id })
          (ok true)
        )
      (err ERR-NOT-FLAGGED)
    )
  )
)

(define-public (analyze-ride-distance (ride-id uint))
  (let ((ride (map-get? rides ride-id)))
    (match ride
      r
        (begin
          (try! (stx-transfer? (var-get analysis-fee) tx-sender (as-contract tx-sender)))
          (if (> (get distance r) (var-get max-distance))
              (try! (flag-ride ride-id "Unrealistic distance"))
              (ok false)
          )
        )
      (err ERR-RIDE-NOT-FOUND)
    )
  )
)

(define-public (analyze-ride-speed (ride-id uint))
  (let ((ride (map-get? rides ride-id)))
    (match ride
      r
        (let ((duration (- (get end-time r) (get start-time r)))
              (speed (/ (get distance r) duration)))
          (try! (stx-transfer? (var-get analysis-fee) tx-sender (as-contract tx-sender)))
          (if (> speed (var-get max-speed))
              (try! (flag-ride ride-id "Excessive speed"))
              (ok false)
          )
        )
      (err ERR-RIDE-NOT-FOUND)
    )
  )
)

(define-public (analyze-ride-duplicate (ride-id uint))
  (let ((ride (map-get? rides ride-id)))
    (match ride
      r
        (begin
          (try! (stx-transfer? (var-get analysis-fee) tx-sender (as-contract tx-sender)))
          (ok false)
        )
      (err ERR-RIDE-NOT-FOUND)
    )
  )
)

(define-public (get-flag-count)
  (ok (var-get next-flag-id))
)

(define-public (is-ride-flagged (ride-id uint))
  (let ((flags (default-to (list) (map-get? flags-by-ride ride-id))))
    (ok (> (len flags) u0))
  )
)