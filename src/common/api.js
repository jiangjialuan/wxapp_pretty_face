/**
 * Created by Administrator on 2017/12/25.
 */
import wepy from 'wepy'
let baseUrl = 'http://sdkdemo.artqiyi.com', videoUrl = 'http://test.yimizhibo.tv',
  faceUrl = 'https://api-cn.faceplusplus.com';

//let baseUrl = 'https://yimi.artqiyi.com', videoUrl = 'https://www.yimizhibo.tv',faceUrl = 'https://api-cn.faceplusplus.com';
export default {
  baseUrl: `${baseUrl}`,
  login: `${videoUrl}/api/v1/applet_login`,
  // 用户相关
  userInfo: `${videoUrl}/api/v1/userinfo`,
  //颜值接口1
  detect: `${faceUrl}/facepp/v3/detect`,
  //颜值接口2
  faceTokenDict: `${faceUrl}/facepp/v3/face/analyze`,
  //获取群ID
  opengid: `${videoUrl}/api/v1/get_applet_opengid`,
  //群排行
  faceCompeteRanking: `${videoUrl}/api/v1/face_compete_ranking`,
  //上图照片
  uploadImg: `${videoUrl}/index/index/upload_img`,
  //颜值PK
  faceCompete: `${videoUrl}/api/v1/face_compete`,
  //个人PK
  personCompete: `${videoUrl}/api/v1/person_compete_result`,
  //获取tokenkey
  getSession(code) {
    return this.request({
      url: this.login,
      method: 'POST',
      data: {
        act: 1,
        code: code,
        buid: this.buid,
        from_uid: this.from_id
      }
    });
  },
  // 获取用户信息
  getUserInfo() {
    return this.request({
      url: this.userInfo,
      data: {
        act: 1
      }
    });
  },
  //用户授权
  getAuthorize(flag){
    return new Promise((resolve, reject) => {
      wepy.login().then((data) => {
        let code = data.code;
        wx.getUserInfo({
          success: (res) => {
            this.request({
              url: this.login,
              data: {
                act: 1,
                code: code,
                iv: res.iv,
                encryptedData: res.encryptedData,
                buid: this.buid
              },
              method: 'POST'
            }).then(json1 => {
              wx.setStorageSync('tokenkey', json1.data.tokenkey);
              this.getUserInfo().then(json => {
                wx.setStorageSync('userInfo', json.data);
                resolve(json.data);
              }).catch(reject);
            }).catch((res) => {
              reject;
            });
          },
          fail: () => {
            if (wx.openSetting) {
              wx.openSetting();
            } else {
              wx.showModal({
                title: '提示',
                showCancel: false,
                content: '由于你取消了授权，请升级到微信最新版本或删掉并搜索"一米好物"进行重新授权'
              });
            }
            reject();
          }
        });
      });
    });
  },
  //pk颜值上传照片
  pkFaceMark(_this){
    wx.showActionSheet({
      itemList: ['从相册选择', '使用微信头像'],
      success: (res) => {
        if (res.tapIndex == 0) {
          wx.chooseImage({
            count: 1, // 默认9
            sizeType: ['original', 'compressed'], // 可以指定是原图还是压缩图，默认二者都有
            sourceType: ['album', 'camera'], // 可以指定来源是相册还是相机，默认二者都有
            success: (res) => {
              // 返回选定照片的本地文件路径列表，tempFilePath可以作为img标签的src属性显示图片
              if (res.tempFiles[0].size / 1024 / 1024 > 2) {
                return;
              } else {
                wx.getImageInfo({
                  src: res.tempFilePaths[0],
                  success: (res) => {
                    _this.showCropper(res);
                  }
                })
              }
            }
          });
        } else if (res.tapIndex == 1) {
          var userInfo = wx.getStorageSync('userInfo');
          wx.setStorageSync('pkPhoto', userInfo.head_pic)
          wx.navigateTo({
            url: `/pages/faceMark?from_index=0`
          });
        }
      },
      fail: function (res) {
        console.log(res.errMsg, '图片上传')
      }
    })
  },
  //照片上传服务器
  pkPhotoUpload(item){
    return new Promise((resolve, reject) => {
      if (item == 1) {
        wx.uploadFile({
          url: this.uploadImg, //仅为示例，非真实的接口地址
          filePath: wx.getStorageSync('pkPhoto'),
          name: 'headpic[]',
          formData: {
            path_code: 20,
            data_type: 'html',
          },
          success: (res) => {
            var res = JSON.parse(res.data);
            wx.setStorageSync('pkPhoto', baseUrl + res.data);
            this.pkPhotoUpload(2).then(res => {
              resolve(res);
            }).catch((res) => {
              reject("检测失败！");
            });
          },
          fail: (res) => {
            reject('图片文件没有找到');
          }
        })
      } else {
        var smData = {
          api_key: this.mg_license_key,
          api_secret: this.mg_license_secret,
        }
        smData.image_url = wx.getStorageSync('pkPhoto');
        var options = {
          url: this.detect,
          data: smData,
          method: 'post'
        };
        this.request(options).then(res => {
          if (res.faces.length == 1) {
            this.pkFaceScore(res).then(res => resolve(res));
          } else if (res.faces.length > 1) {
            wx.showToast({
              title: '请上传只有一张人脸的照片',
              icon: 'warn',
              duration: 2000
            });
            return reject("检测失败！");
          } else {
            return resolve(0);
          }
        }).catch(res => {
          return reject("检测失败！");
        })
      }
    });
  },
  //PK颜值计算得分
  pkFaceScore(json){
    return this.request({
      url: this.faceTokenDict,
      data: {
        api_key: this.mg_license_key,
        api_secret: this.mg_license_secret,
        face_tokens: json.faces[0].face_token,
        return_attributes: 'age,beauty,gender,skinstatus,blur,headpose,facequality'
      },
      method: 'post'
    }).then(res => {
      var faces = res.faces[0].attributes;
      if (faces.gender.value == "Female") {
        var beautyValue = faces.beauty.female_score;
      } else {
        var beautyValue = faces.beauty.male_score;
      }
      var isOld = faces.age > 35 ? true : false,
        isRollAngle = Math.abs(faces.headpose.roll_angle) > 30 ? true : false,
        isBlur = faces.blur.blurness.value > faces.blur.blurness.threshold ? true : false;
      beautyValue = isOld ? beautyValue + (100 - beautyValue) * 0.1 : beautyValue;
      beautyValue = isRollAngle ? beautyValue + (100 - beautyValue) * 0.1 : beautyValue;
      beautyValue = isBlur ? beautyValue + (100 - beautyValue) * 0.1 : beautyValue;
      beautyValue = beautyValue + (100 - beautyValue) * 0.2;
      return beautyValue;
    }).catch(res => {
    });
  },
  //获取群ID
  getGrounpId(flag){
    return new Promise((resolve, reject) => {
      if (wx.getStorageSync('shareTicket')) {
        if (wx.getShareInfo) {
          wx.getShareInfo({
            shareTicket: wx.getStorageSync('shareTicket'),
            success: (res) => {
              var options = {
                act: 1,
                iv: res.iv,
                encryptedData: res.encryptedData,
                buid: this.buid
              }
              wepy.login().then(res => {
                options.code = res.code;
                options.tokenkey = wx.getStorageSync('tokenkey');
                if (res.uid) {
                  wx.setStorageSync('uid', res.data.data.uid);
                }
                this.request({
                  url: this.opengid,
                  method: 'post',
                  data: options
                }).then(json => {
                  if (Object.prototype.toString.call(json) === "[object String]") {
                    if (flag) {
                      wx.showModal({
                        title: '提示',
                        showCancel: false,
                        content: 'Internal Server Error'
                      });
                      reject;
                    } else {
                      this.getGrounpId('true').then((res) => {
                        resolve(res);
                      })
                    }
                  } else {
                    resolve(json);
                  }
                }).catch(res => {
                  reject;
                });
              });
            },
            fail: (res) => {
              reject(res);
            }
          })
        } else {
          // 如果希望用户在最新版本的客户端上体验您的小程序，可以这样子提示
          wx.showModal({
            title: '提示',
            content: '当前微信版本过低，无法使用该功能，请升级到最新微信版本后重试。'
          })
          return;
        }
      }
    });
  },
  //检测登录
  checkLogin(){
    debugger;
    let tokenkey = wx.getStorageSync('tokenkey') || '';
    let requestData = {
      url: this.userInfo,
      data: {
        act: 1,
        tokenkey: tokenkey
      },
      header: {
        'content-type': 'application/x-www-form-urlencoded',
      }
    };
    return new Promise((resolve, reject) => {
      wepy.request(requestData).then(json => {
        var data = json.data.data;
        if (data.uid) {
          wx.setStorageSync('userInfo', data);
          resolve(data);
        } else {
          wepy.login()
            .then(res => this.getSession(res.code))
            .then(res => {
              wx.setStorageSync('tokenkey', res.data.tokenkey);
              if (res.uid) {
                wx.setStorageSync('uid', res.uid);
              }
              resolve(res);
            });
        }
      });
    });
  },
  //统一请求方法
  request(options, again) {
    let tokenkey = wx.getStorageSync('tokenkey') || '', reqData = options.data || {};
    reqData.tokenkey = tokenkey;
    let requestData = {
      url: options.url,
      header: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      data: reqData,
      dataType: options.dataType || 'json',
      method: options.method || 'GET'
    };
    return new Promise((resolve, reject) => {
      wepy.request(requestData).then(res => {
        if (!res.data.state) {
          resolve(res.data);
        } else {
          if (res.data.state.code === 10401 || res.data.state.code === '10401') {
            if (again) {
              reject('Something is wrong');
              return;
            }
            wepy.login().then(res => this.getSession(res.code)).then(res => {
              wx.setStorageSync('tokenkey', res.data.data.tokenkey);
              if (res.uid) {
                wx.setStorageSync('uid', res.data.data.uid);
              }
              return this.request(options, true);
            });
          } else {
            resolve(res.data);
          }
        }
      }).catch(reject);
    });
  },
  from_id: 0,
  buid: 1,
  mg_license_key: 'ZUhGw2COyRdk4fv2FY6eDv9quDbHNtuP',
  mg_license_secret: 's5DsEsp3Wjk-W3m41JP2ZcFaTTU8la4E',
}
