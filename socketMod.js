var io, socket, async, redisMod;
var dbnotices, dbusers, dbdislikes, dbjoins, dbworks, dbbadges, dbbadgemaps, dblogs;

function setIoAsyncRedis(_io, _async, _redisMod) {
	io = _io;
	async = _async;
	redisMod = _redisMod;
	
	io.on('connection', function(_socket) {
		socket = _socket;
		
		socket.emit('news', {});
		
		socket.on('namecheck', nameCheck);
		socket.on('titlecheck', titleCheck);
		socket.on('clientUpdateDislike', updateDislike);
		socket.on('clientUpdateJoin', updateJoin);
		socket.on('reqNotices', getNotices);
		socket.on('clientGetLogs', getLogs);
		socket.on('clientPostLog', postLog);
		socket.on('readNotice', readNotice);
		socket.on('removeNotice', removeNotice);
	});
}

function setDBs(_dbnotices, _dbusers, _dbdislikes, _dbjoins, _dbworks, _dbbadges, _dbbadgemaps, _dblogs) {
	dbnotices = _dbnotices;
	dbusers = _dbusers;
	dbdislikes = _dbdislikes;
	dbjoins = _dbjoins;
	dbworks = _dbworks;
	dbbadges = _dbbadges;
	dbbadgemaps = _dbbadgemaps;
	dblogs = _dblogs
}

function nameCheck(data) {
	console.log(data);	// 닉네임 체크할 때는 가입이 되어있지 않은 상태이므로 그냥 봐준다.
	if(data) {
		dbusers.searchByNickname(data.nickname, function(user, err) {
			if(err) console.error(err);
			else if(!user) { // 가능한 닉네임
				socket.emit('namechecked', true);
			} else { // 이미 존재하는 닉네임
				socket.emit('namechecked', false);
			}
		});
	} else socket.emit('namechecked', false);
}
function titleCheck(data) {
	if(data.userId != null) {
		redisMod.getSession(data.userId, function(obj) {		// 유저가 레디스에 저장되어 있다면 obj 는 null 이 아니다
			if(obj != null) {
				console.log(data);
				if(data) {
					dbworks.searchByName(data.title, function(work, err) {
						if(err) console.error(err);
						else if(!work) { // 가능한 공작이름
							socket.emit('titlechecked', true);
						} else { // 이미 존재하는 공작이름
							socket.emit('titlechecked', false);
						}
					});
				} else socket.emit('titlechecked', false);
			}
		});
	}
}

function getDislikesAtWorkPage(data){
	if(data.userId != null) {
		redisMod.getSession(data.userId, function(obj) {		// 유저가 레디스에 저장되어 있다면 obj 는 null 이 아니다
			if(obj != null) {
				dbdislikes.getWorkDislikesNum(data.workId, function(numDislikes) {
					console.log("방송을한다!!".cyan);
					socket.emit('serverGetDislikesNum', numDislikes);
					socket.broadcast.emit('serverGetDislikesNum', numDislikes);
				});
			}
		});
	}
}

function updateDislike(data) {
	if(data.userId != null) {
		redisMod.getSession(data.userId, function(obj) {		// 유저가 레디스에 저장되어 있다면 obj 는 null 이 아니다
			if(obj != null) {
				async.waterfall([
					function(callback) {
						async.parallel([
							function(cb) {
								dbdislikes.searchById(data.userId, data.workId, function(dislikes, err) {
									if(err) console.log(err);
									else{
										cb(null, dislikes);
									}
								});
							},
							function(cb) {
								dbjoins.searchById(data.userId, data.workId, function(result, err) {
									if(err) console.error(err);
									else{
										cb(null, result);
									}
								});
							}
						],
						function(err, result) {
							if(result[1] != null) {
								if(result[0] == null) {
									dbnotices.putNotice(data.userId, ee1(), function(notice, err) {
										if(err) console.error(err);
										else {
											socket.emit('downNotices', [notice]);
											dbbadgemaps.giveBadge(data.userId, 1, function(badgemaps, err) {
												if(err) console.error(err);
												else if(badgemaps) console.log('뱃지 수여됨') // 업보 반영까지 된 상태
												callback(null); // 이미 뱃지를 가지고 있었다면 null 을 반환한다
											});
										}
									});
								} else {
									dbbadgemaps.removeBadge(data.userId, 1, function(err) {
										if(err) console.error(err);
										else callback(result[0]);
									}); //줬다 뺏기
								}
							} else {
								callback(result[0]);
							}
						});
					}
				],
				function(dislikes) {
					dbdislikes.toggleTuple(dislikes, data, function() {
						getDislikesAtWorkPage(data);
					});
				});
			}
		});
	}
}

function updateJoin(data){
	if(data.userId != null) {
		redisMod.getSession(data.userId, function(obj) {		// 유저가 레디스에 저장되어 있다면 obj 는 null 이 아니다
			if(obj != null) {
				async.waterfall([
					function(callback) {
						dbjoins.searchById(data.userId, data.workId, function(joins, err){
							if(err) console.log(err);
							else{
								callback(null, joins);
							}
						});
					},
					function(joins, callback) {
						dbjoins.toggleTuple(joins, data, function(){
							callback();
						});
					}
				],
				function(err, result) {
					dbjoins.searchWorksJoin(data.workId, function(result){
						var joinedUsers = [];
						async.forEachOf(result, function(join, key, callback) {
							dbusers.searchById(join.userId, function(user){
								joinedUsers[key] = user;
								callback();
							});
						}, function(err) {
							socket.broadcast.emit('serverUpdateJoin', joinedUsers);
							socket.emit('serverUpdateJoin', joinedUsers);
						});
					});
				});
			}
		});
	}
}

function getNotices(data) {
	if(data.userId != null) {
		redisMod.getSession(data.userId, function(obj) {		// 유저가 레디스에 저장되어 있다면 obj 는 null 이 아니다
			if(obj != null) {
				dbnotices.peekNotice(data.userId, function(result, err){
					if(err) console.error(err);
					else {
						socket.emit('downNotices', result);
					}
				});
			}
		});
	}
}

function postLog(data) {
	if(data.userId != null) {
		redisMod.getSession(data.userId, function(obj) {		// 유저가 레디스에 저장되어 있다면 obj 는 null 이 아니다
			if(obj != null) {
				dblogs.createLog( data.userId, data.workName, data.text, dbworks, function(log, err){
					if(err) console.error(err);
					else{
						console.log("로그가 성공적으로 올라갔습니다.".cyan);
						socket.emit("serverPostLog", {thiss:"sss"})
						getLogs( data );
					}
				});
			}
		});
	}
}

function getLogs(data) {
	if(data.userId != null) {
		redisMod.getSession(data.userId, function(obj) {		// 유저가 레디스에 저장되어 있다면 obj 는 null 이 아니다
			if(obj != null) {
				dblogs.getWorksAllLog( data.workId, function(result, err){
					if(err)	console.error(err);
					else{
						console.log("로그를 성공적으로 반환".cyan);
						socket.emit("serverGetLogs", result)
					}
				});
			}
		});
	}
}

function removeNotice(data) {
	if(data.userId != null) {
		redisMod.getSession(data.userId, function(obj) {		// 유저가 레디스에 저장되어 있다면 obj 는 null 이 아니다
			if(obj != null) {
				dbnotices.removeNotice(data.msgId, function(result, err){
					console.log("삭제했다!!".cyan);
				});
			}
		});
	}
}

function readNotice(data) {
	if(data.userId != null) {
		redisMod.getSession(data.userId, function(obj) {		// 유저가 레디스에 저장되어 있다면 obj 는 null 이 아니다
			if(obj != null) {
				dbnotices.readNotice(data.msgId, function(result, err) {
					console.log("읽었다!!".cyan);
				});
			}
		});
	}
}

module.exports = {
	setDBs: setDBs,
	setIoAsyncRedis: setIoAsyncRedis
}


// 이스터 에그 #1
function ee1() {
	var strings = [
		"이런반동놈의자식!!!",
		"자기혐오는 네녀석의 업보다",
		"*축* 반동분자",
		"야이 갸샤꺄"
	];
	return strings[ Math.floor(Math.random()*strings.length) ];
}