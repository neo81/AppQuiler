PRAGMA foreign_keys = ON;
CREATE TABLE guests(id TEXT PRIMARY KEY,name TEXT NOT NULL,phone TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE INDEX guests_name ON guests(name COLLATE NOCASE);
CREATE TABLE rates(id TEXT PRIMARY KEY,effective_from TEXT NOT NULL UNIQUE,nightly INTEGER NOT NULL CHECK(nightly>0),weekly INTEGER NOT NULL CHECK(weekly>0),label TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TABLE reservations(id TEXT PRIMARY KEY,guest_id TEXT NOT NULL REFERENCES guests(id),arrival TEXT NOT NULL,departure TEXT NOT NULL CHECK(departure>arrival),arrival_time TEXT NOT NULL,departure_time TEXT NOT NULL,persons INTEGER NOT NULL CHECK(persons BETWEEN 1 AND 20),mode TEXT NOT NULL CHECK(mode IN('night','week','fortnight','combined')),base TEXT NOT NULL CHECK(base IN('week','fortnight')),nightly INTEGER NOT NULL CHECK(nightly>=0),weekly INTEGER NOT NULL CHECK(weekly>=0),total INTEGER NOT NULL CHECK(total>0),guarantee INTEGER NOT NULL DEFAULT 0 CHECK(guarantee>=0),notes TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN('confirmed','cancelled')),cancellation_reason TEXT,version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE INDEX reservations_dates ON reservations(status,arrival,departure);
CREATE TABLE blocks(id TEXT PRIMARY KEY,arrival TEXT NOT NULL,departure TEXT NOT NULL CHECK(departure>arrival),reason TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)));
CREATE INDEX blocks_dates ON blocks(active,arrival,departure);
CREATE TABLE payments(id TEXT PRIMARY KEY,reservation_id TEXT NOT NULL REFERENCES reservations(id),kind TEXT NOT NULL CHECK(kind IN('rent','deposit','deposit_refund','rent_refund')),amount INTEGER NOT NULL CHECK(amount>0),date TEXT NOT NULL,method TEXT NOT NULL CHECK(method IN('Transferencia','Efectivo','Otro')),notes TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE INDEX payments_reservation ON payments(reservation_id);
CREATE TABLE credentials(id TEXT PRIMARY KEY,public_key TEXT NOT NULL,counter INTEGER NOT NULL,name TEXT NOT NULL,transports TEXT NOT NULL,enrollment_key TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,credential_id TEXT NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires);
CREATE TABLE challenges(id TEXT PRIMARY KEY,challenge TEXT NOT NULL,kind TEXT NOT NULL,expires INTEGER NOT NULL,invite_hash TEXT);
CREATE TABLE invitations(token_hash TEXT PRIMARY KEY,expires INTEGER NOT NULL);
CREATE TABLE audit(id INTEGER PRIMARY KEY AUTOINCREMENT,entity TEXT NOT NULL,entity_id TEXT NOT NULL,action TEXT NOT NULL,previous TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TRIGGER reservation_insert_overlap BEFORE INSERT ON reservations WHEN NEW.status='confirmed' BEGIN
 SELECT RAISE(ABORT,'RESERVATION_OVERLAP') WHERE EXISTS(SELECT 1 FROM reservations WHERE status='confirmed' AND arrival<NEW.departure AND departure>NEW.arrival);
 SELECT RAISE(ABORT,'BLOCK_OVERLAP') WHERE EXISTS(SELECT 1 FROM blocks WHERE active=1 AND arrival<NEW.departure AND departure>NEW.arrival);
END;
CREATE TRIGGER reservation_update_overlap BEFORE UPDATE ON reservations WHEN NEW.status='confirmed' BEGIN
 SELECT RAISE(ABORT,'RESERVATION_OVERLAP') WHERE EXISTS(SELECT 1 FROM reservations WHERE id<>NEW.id AND status='confirmed' AND arrival<NEW.departure AND departure>NEW.arrival);
 SELECT RAISE(ABORT,'BLOCK_OVERLAP') WHERE EXISTS(SELECT 1 FROM blocks WHERE active=1 AND arrival<NEW.departure AND departure>NEW.arrival);
END;
CREATE TRIGGER block_insert_overlap BEFORE INSERT ON blocks WHEN NEW.active=1 BEGIN
 SELECT RAISE(ABORT,'RESERVATION_OVERLAP') WHERE EXISTS(SELECT 1 FROM reservations WHERE status='confirmed' AND arrival<NEW.departure AND departure>NEW.arrival);
 SELECT RAISE(ABORT,'BLOCK_OVERLAP') WHERE EXISTS(SELECT 1 FROM blocks WHERE active=1 AND arrival<NEW.departure AND departure>NEW.arrival);
END;
CREATE TRIGGER payment_limits BEFORE INSERT ON payments BEGIN
 SELECT RAISE(ABORT,'PAYMENT_EXCEEDS_TOTAL') WHERE NEW.kind='rent' AND NEW.amount+(SELECT COALESCE(SUM(CASE kind WHEN 'rent' THEN amount WHEN 'rent_refund' THEN -amount ELSE 0 END),0) FROM payments WHERE reservation_id=NEW.reservation_id)>(SELECT total FROM reservations WHERE id=NEW.reservation_id);
 SELECT RAISE(ABORT,'REFUND_EXCEEDS_COLLECTED') WHERE NEW.kind='rent_refund' AND NEW.amount>(SELECT COALESCE(SUM(CASE kind WHEN 'rent' THEN amount WHEN 'rent_refund' THEN -amount ELSE 0 END),0) FROM payments WHERE reservation_id=NEW.reservation_id);
 SELECT RAISE(ABORT,'REFUND_EXCEEDS_COLLECTED') WHERE NEW.kind='deposit_refund' AND NEW.amount>(SELECT COALESCE(SUM(CASE kind WHEN 'deposit' THEN amount WHEN 'deposit_refund' THEN -amount ELSE 0 END),0) FROM payments WHERE reservation_id=NEW.reservation_id);
 SELECT RAISE(ABORT,'DEPOSIT_EXCEEDS_TOTAL') WHERE NEW.kind='deposit' AND NEW.amount+(SELECT COALESCE(SUM(CASE kind WHEN 'deposit' THEN amount WHEN 'deposit_refund' THEN -amount ELSE 0 END),0) FROM payments WHERE reservation_id=NEW.reservation_id)>(SELECT guarantee FROM reservations WHERE id=NEW.reservation_id);
 SELECT RAISE(ABORT,'RESERVATION_CANCELLED') WHERE NEW.kind IN('rent','deposit') AND (SELECT status FROM reservations WHERE id=NEW.reservation_id)='cancelled';
END;
CREATE TRIGGER reservation_payment_floor BEFORE UPDATE ON reservations BEGIN
 SELECT RAISE(ABORT,'TOTAL_BELOW_COLLECTED') WHERE NEW.total<(SELECT COALESCE(SUM(CASE kind WHEN 'rent' THEN amount WHEN 'rent_refund' THEN -amount ELSE 0 END),0) FROM payments WHERE reservation_id=NEW.id);
 SELECT RAISE(ABORT,'DEPOSIT_BELOW_COLLECTED') WHERE NEW.guarantee<(SELECT COALESCE(SUM(CASE kind WHEN 'deposit' THEN amount WHEN 'deposit_refund' THEN -amount ELSE 0 END),0) FROM payments WHERE reservation_id=NEW.id);
END;
CREATE TRIGGER reservation_audit AFTER UPDATE ON reservations BEGIN INSERT INTO audit(entity,entity_id,action,previous) VALUES('reservation',NEW.id,CASE WHEN OLD.status<>NEW.status THEN 'cancel' ELSE 'edit' END,json_object('arrival',OLD.arrival,'departure',OLD.departure,'total',OLD.total,'status',OLD.status)); END;
CREATE TRIGGER guest_audit AFTER UPDATE ON guests BEGIN INSERT INTO audit(entity,entity_id,action,previous) VALUES('guest',NEW.id,'edit',json_object('name',OLD.name,'phone',OLD.phone,'notes',OLD.notes)); END;
CREATE TRIGGER block_audit AFTER UPDATE ON blocks BEGIN INSERT INTO audit(entity,entity_id,action) VALUES('block',NEW.id,'release'); END;
