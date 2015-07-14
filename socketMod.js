var dbnotices, dbusers, dbdislikes, dbjoins, dbworks, dbowns, dbbadges, dbbadgemaps;
var socket, async;

function setDBs(_dbnotices, _dbusers, _dbdislikes, _dbjoins, _dbworks, _dbowns, _dbbadges, _dbbadgemaps) {
	dbnotices = _dbnotices;
	dbusers = _dbusers;
	dbdislikes = _dbdislikes;
	dbjoins = _dbjoins;
	dbworks = _dbworks;
	dbowns = _dbowns;
	dbbadges = _dbbadges;
	dbbadgemaps = _dbbadgemaps;
}

function setSocketAndAsync(_socket, _async) {
	socket = _socket;
	async = _async;
}

function nameCheck(data) {
	console.log(data);
	if(data) {
		dbusers.searchByNickname(data, function(user, err) {
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
	console.log(data);
	if(data) {
		dbworks.searchByName(data, function(work, err) {
			if(err) console.error(err);
			else if(!work) { // 가능한 공작이름
				socket.emit('titlechecked', true);
			} else { // 이미 존재하는 공작이름
				socket.emit('titlechecked', false);
			}
		});
	} else socket.emit('titlechecked', false);
}

function updateDislike(data) {
	async.waterfall([
		function(callback) {
			async.parallel([
				function(cb) {
					dbdislikes.searchById( data.userId, data.workId, function(dislikes, err) {
						console.log("0-1".cyan);
						if(err) console.log(err);
						else{
							console.log("0-1-success".cyan);
							cb(null, dislikes);
						}
					});
				},
				function(cb) {
					dbjoins.searchById( data.userId, data.workId, function( result, err ){
						console.log("0-2".cyan);
						if(err) console.error(err);
						else{
							console.log("0-2-success".cyan);
							cb(null, result);
						}
					});
				}
			],
			function(err, result) {
				console.log("0-intro".cyan);
				if(result[1] != null) {
					console.log("0".cyan);
					dbnotices.putNotice( data.userId, "이런반동놈의자식!!!", function(){
						console.log("1".cyan);
						dbbadgemaps.searchBadgeExist( data.userId, "반동놈의자식", function(exist, err){
							console.log("2".cyan);
							if( exist == null){
								console.log("3".cyan);
								dbbadgemaps.giveBadge( data.userId, "반동놈의자식", function(){
									callback(null, result[0]);
								});
							}else{
								callback(null, result[0]);
							}
						});
					});
				}else{
					console.log("0-else".cyan);
					callback(null, result[0]);
				}
			});
		},
		function(dislikes, callback) {
			dbdislikes.toggleTuple(dislikes, data, function(){
				callback();
			});
		}
	]);

}
function updateJoin(data){
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
		dbjoins.searchUsersJoin(data.userId, function(result){
			socket.broadcast.emit('serverUpdate',result);
			socket.emit('serverUpdate',result);
		});
	});
}


function getNotice(data){
	// 이거 하자
}

module.exports = {
	setDBs: setDBs,
	setSocketAndAsync: setSocketAndAsync,
	nameCheck: nameCheck,
	titleCheck: titleCheck,
	updateDislike: updateDislike,
	updateJoin: updateJoin
}