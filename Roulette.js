const setting = require('./setting.json');
const token = setting.token;
const accChannelid = setting.accChannelID;//允許的頻道ID 設0為不限制
const moneyunit = setting.moneyunit;//金錢單位 ex:元,G,個硬幣,根蘿蔔 之類的詞 設定成奇怪的東西出事不負責
const keyword = setting.keyword;//前綴字串 觸發賭博用
const black_set = [1,3,5,8,10,12,14,16,18,19,21,23,26,28,30,31,33,35];
const red_set = [2,4,6,7,9,11,13,15,17,20,22,24,25,27,29,32,34,36];

const { Client, Intents, MessageActionRow } = require('discord.js');
const Roulette_Bot = new Client({ intents: [
  Intents.FLAGS.GUILDS,
  Intents.FLAGS.GUILD_MESSAGES,
  Intents.FLAGS.DIRECT_MESSAGES
], partials: [
  Intents.FLAGS.CHANNEL
]});

Roulette_Bot.on('ready', () => {
  console.log(`Logged in as ${Roulette_Bot.user.tag}!`);
});

//主程式 接收訊息系統
Roulette_Bot.on('messageCreate', message => {
  if((!message.author.bot) && ((message.channelId == accChannelid) || (accChannelid == 0))){//確認訊息不是來自機器人的並且在允許的頻道或不限制頻道
    console.log(`[${message.channel.name}(${message.channelId})]${message.author.username}(${message.author.id}): ${message.content}`);
    if(message.content.indexOf(keyword) == 0){//確認格式
      let original_str = message.content.substring(keyword.length).trim();
      let comp_json;
      let try_json = true, try_split = true, help = false;
      if(original_str.length < 10){
        if(original_str.toLowerCase().indexOf("help") == 0){
          help = true;
          rephelp(message);
        }else if(original_str.indexOf("詞語表") == 0){
          help = true;
          changetable(message);
        }
      }
      if(!help){
        try{
          comp_json = JSON.parse(original_str);
        }catch(error){
          console.log("無法以JSON解析");
          //message.reply('無法解析下注方式\" ' + original_str + ' \"');
          try_json = false;
        }
        if(!try_json){//如果JSON無法解析 試試字串切分
          comp_json = [];
          const sp_space = original_str.split(/\s|\s下注|下注/);
          //console.log(sp_space.length);
          if(sp_space.length > 0){
            for(let i = 0; i < sp_space.length; i++){
              if(sp_space[i] == ""){
                continue;
              }else{
                const sp_dot = sp_space[i].split(/\.|\||賭注/);
                //console.log(sp_dot);
                if(sp_dot.length == 2){
                  const sp_comma = sp_dot[0].split(",");
                  let smi_json = {};
                  smi_json.betstype = sp_comma;
                  smi_json.bets =sp_dot[1];
                  comp_json.push(smi_json);
                }else{
                  try_split = false;
                  break;
                }
              }
            }
          }
        }
        if((try_json || try_split) && comp_json.length > 0){//如果成功解析JSON 且有東西 判斷輸入合法性
          let stand_json = [];
          //console.log(comp_json);
          let pass = true;
          for(let i = 0; i < comp_json.length; i++){//查看每條下注
            let stand = roulette_stand(comp_json[i]);
            //console.log(stand);
            if(stand === 0){
              //message.reply('無法解析下注方式\" ' + JSON.stringify(comp_json[i]) + ' \"');
              needhelp(message);
              pass = false;
              break;
            }else{
              stand_json.push(stand);
            }
          }
          if(pass){//如果輸入的都正確
            console.log("成功解析下注");
            //console.log(stand_json);
            let usermoney = 0;
            //將usermoney設定為玩家的現有金錢量
            if(usermoney >= needmoney(stand_json) || true){//錢夠的話
              let ball = Math.floor(Math.random() * 37);
              Roulette_checkwin(stand_json,ball);
              //console.log(stand_json);
              let get = getmoney(stand_json);
              let get_str = "";
              switch(true){
                case (get > 0):
                  get_str = "你贏得了" + get + moneyunit;
                  break;
                case (get < 0):
                  get_str = "你輸掉了" + -get + moneyunit;
                  break;
                case (get == 0):
                  get_str = "你的賭注剛好抵銷了 沒有獲得獲失去金錢";
              }
              if(get != 0){
                //幫玩家進行get數量的金錢變更
              }
              message.reply("__輪盤轉到了" + ball + "__\n\n以下為你的下注:\n" + roulette_toString(stand_json) + "\n\n" + get_str);
              console.log(`${message.author.username}(${message.author.id})進行了輪盤 金錢變更為${get}`)
            }else{
              message.reply("你擁有的金錢不足以下注");
            }
          }
        }else{
          needhelp(message);
        }
      }
    }
  }
});
//login
Roulette_Bot.login(token);

//以下為function
function IsNum(s)//判斷是否為數字
{
  if(s!=null && s!=undefined){
    let r,re;
    re = /\d*/i; //\d表示數字,*表示匹配多回個數字
    r = s.toString().match(re);
    return (r==s && s!='') ? true : false;
  }
  return false;
}

function IsLet(s)//判斷是否為單個字母
{
  if(s!=null && s!=undefined){
    let r,re;
    re = /[a-zA-Z]?/i;
    r = s.toString().match(re);
    return (r==s && s!='') ? true : false;
  }
  return false;
}

function roulette_stand(injson){//將json格式化為純數字並回傳完整JSON
  try{
    let betstype = [];
    let betsname;
    betstype = injson.betstype;
    //console.log("stand " + betstype);
    if(IsNum(injson.bets)){
      let bets = parseInt(injson.bets,10);
      let fastcode = true;
      let lesttype = [];
      for(let i = 0;i < betstype.length; i++){//數字或英文
        if(IsNum(betstype[i].toString())){//數字
          if(parseInt(betstype[i], 10) < 0 || parseInt(betstype[i], 10) > 36){
            //console.log("size")
            return 0;
          }
          lesttype.push(parseInt(betstype[i], 10));
        }else if(IsLet(betstype[i].toString())){//英文
          let startat = betstype[i].toLowerCase().charCodeAt() - 97;
          if(startat > 11){
            return 0;
          }
          for(let i = 1; i <= 3; i++){//轉成數字
            lesttype.push(startat*3+i);
          }
        }else{
          fastcode = false;
        }
      }
      //console.log(fastcode);
      if(fastcode){//如果是數字或英文組成
        if(!roulette_usability(lesttype)){
          //console.log("Fail");
          return 0;
        }
        betsname = roulette_numbtoname(lesttype);
        //console.log(betsname);
      }else{//若不是 則分別判斷
        lesttype = [];
        if(betstype.length == 1){
          let str = betstype[0];
          switch(str.toLowerCase().trim()){
            case "1~18":case "1to18":case "1-18":case "1_18":case "前半":
              for(let i=1; i<=18; i++){//前半
                lesttype.push(i);
              }
              betsname = ["1to18"];
            break;
            case "19~36":case "19to36":case "19-36":case "19_36":case "後半":
              for(let i=19; i<=36; i++){//後半
                lesttype.push(i);
              }
              betsname = ["19to36"];
            break;
            case "1~12":case "1to12":case "1_12":case "1-12":case "1of12":case "1st12":
              for(let i=1; i<=12; i++){//前12
                lesttype.push(i);
              }
              betsname = ["1st12"];
            break;
            case "13~24":case "13to24":case "13_24":case "13-24":case "2of12":case "2nd12":case "2_12":case "2-12":
              for(let i=13; i<=24; i++){//中12
                lesttype.push(i);
              }
              betsname = ["2nd12"];
            break;
            case "25~36":case "25to36":case "25_36":case "25-36":case "3of12":case "3rd12":case "3_12":case "3-12":
              for(let i=25; i<=36; i++){//後12
                lesttype.push(i);
              }
              betsname = ["3rd12"];
            break;
            case "1~34":case "1_34":case "1-34":case "1to34":case "1col":case "1_c":case "1_col":case "1 col":case "1ofcol":
              for(let i=1; i<=34; i+=3){//下行 1
                lesttype.push(i);
              }
              betsname = ["1col"];
            break;
            case "2~35":case "2_35":case "2-35":case "2to35":case "2col":case "2_c":case "2_col":case "2 col":case "2ofcol":
              for(let i=2; i<=35; i+=3){//中行 2
                lesttype.push(i);
              }
              betsname = ["2col"];
            break;
            case "3~36":case "3_36":case "3-36":case "3to36":case "3col":case "3_c":case "3_col":case "3 col":case "3ofcol":
              for(let i=3; i<=36; i+=3){//上行 3
                lesttype.push(i);
              }
              betsname = ["3col"];
            break;
            case "odd":case "奇數":
              for(let i=1; i<=35; i+=2){//奇數
                lesttype.push(i);
              }
              betsname = ["ODD"];
            break;
            case "even":case "偶數":
              for(let i=2; i<=36; i+=2){//偶數
                lesttype.push(i);
              }
              betsname = ["EVEN"];
            break;
            case "black":case "黑":case "黑色"://黑
              lesttype = [1,3,5,8,10,12,14,16,18,19,21,23,26,28,30,31,33,35];
              betsname = ["Black"];
            break;
            case "red":case "紅":case "紅色"://紅
              lesttype = [2,4,6,7,9,11,13,15,17,20,22,24,25,27,29,32,34,36];
              betsname = ["Red"];
            break;
            default:
              return 0;
          }
        }else{
          return 0;
        }
      }
      return {"betstype":lesttype,"bets":bets,"betsname":betsname,"win":false};
    }else{
      return 0;
    }
  }catch(e){
    //console.log(e);
    return 0;
  }
}

function roulette_usability(arrin){//確認直接輸入的數字可用性
  let arr = arrin;
  sort(arr);
  let check = [];
  for(let i = 1;i < arr.length; i++){//確認沒有重複
    if(check.indexOf(arr[i]) != -1){
      return false;
    }else{
      check.push(arr[i]);
    }
  }
  //console.log("arr.len " + arr.length);
  switch(arr.length){
    case 1:
      return true;
    case 2:
      switch(true){
        case (arr[1] === arr[0]+3):
        case ((arr[0]%3 != 0) && (arr[1] === arr[0]+1)):
        case ((arr[0] === 0) && (arr[1] === 1 || arr[1] === 2 || arr[1] === 3)):
          return true;
        default:
          return false;
      }
    case 3:
      switch(true){
        case (arr[1] === arr[0]+1 && arr[2] === arr[0]+2):
        case (arr[0] === 0 && arr[1] === 1 && arr[2] === 2):
        case (arr[0] === 0 && arr[1] === 2 && arr[2] === 3):
          return true;
        default:
          return false;
      }
    case 4:
      if(arr[0]%3 != 0 && arr[0] < 32){
        if((arr[1] === arr[0]+1) && (arr[2] === arr[0]+3) && (arr[3] === arr[0]+4)){
          return true;
        }
      }else if((arr[0] === 0) && (arr[1] === 1) && (arr[2] === 2) && (arr[3] === 3)){
        return true;
      }else{
        return false;
      }
    case 6:
      if((arr[0]%3 === 1) && (arr[5] === arr[0]+5)){
        return true;
      }else{
        return false;
      }
    case 12:
      if(((arr[0] === 1) || (arr[0] === 13) || (arr[0] === 25)) && (arr[11] === arr[0]+11)){
        return true;
      }else{
        let pos = 0;
        for(let i=1; i<=34; i+=3){//下行 1
          if(arr[pos++] != i){
            break;
          }
        }
        if(pos === 11){
          return true;
        }else{
          pos = 0;
        }
        return false;
      }
    case 18:
      if(((arr[0] === 1) || (arr[0] === 18)) && (arr[17] === arr[0]+17)){
        return true;
      }else{
        let pos = 0;
        for(let i=1; i<=35; i+=2){//奇數
          if(arr[pos++] != i){
            break;
          }
        }
        if(pos === 17){
          return true;
        }else{
          pos = 0;
          for(let i=2; i<=36; i+=2){//偶數
            if(arr[pos++] != i){
              break;
            }
          }
          if(pos === 17){
            return true;
          }else{
            for(let i = 0;i < arr.length; i++){//紅黑
              if(arr[i] != (arr[0] === 1 ? black_set[i] : red_set[i])){
                return false;
              }
            }
            return true;
          }
        }
      }
    default:
        return false;
  }
}

function roulette_numbtoname(numbarr){//將數字陣列轉為下注方式
  sort(numbarr);
  let arr = numbarr;
  switch(arr.length){
    case 1:
    case 2:
      return numbarr;
    case 3:
      if(arr[0] === 0){
        return numbarr;
      }else{
        return [String.fromCharCode(Math.floor(arr[0] / 3) + 65)];
      }
    case 4:
      if(arr[0] === 0){
        return [0,"A"];
      }else{
        return numbarr;
      }
    case 6:
      return [String.fromCharCode(Math.floor(arr[0] / 3) + 65),String.fromCharCode(Math.floor(arr[3] / 3) + 65)];
    case 12:
      if(((arr[0] === 1) || (arr[0] === 13) || (arr[0] === 25)) && (arr[11] === arr[0]+11)){
        switch(arr[0]){
          case 1:
            return ["1st12"];
          case 13:
            return ["2nd12"];
          case 25:
            return ["3rd12"];
        }
      }else{
        return [arr[0] + "col"];
      }
    case 18:
      if(((arr[0] === 1) || (arr[0] === 18)) && (arr[17] === arr[0]+17)){
        return arr[0] === 1 ? ["1to18"] : ["19to36"];
      }else{
        if(arr[0]===1){
          if(arr[3]===7){
            return ["ODD"];
          }else{
            return ["Black"];
          }
        }else{
          if(arr[3]===8){
            return ["EVEN"];
          }else{
            return ["Red"];
          }
        }
      }
  }
}

function roulette_toString(finaljson){//說人話
  let str = "";
  for(let i = 0; i < finaljson.length; i++){
    let magnification = 36 / finaljson[i].betstype.length;
    if(finaljson[i].win){
      str += "**下注種類: \"" + finaljson[i].betsname + "\", 賭注: " + finaljson[i].bets + moneyunit + ", 倍率:" + magnification + "** 獲得:" + finaljson[i].bets*magnification + moneyunit;
    }else{
      str += "~~下注種類: \"" + finaljson[i].betsname + "\", 賭注: " + finaljson[i].bets + moneyunit + ", 倍率:" + magnification + "~~ 失去:" + finaljson[i].bets + moneyunit;
    }
    if(i != finaljson.length - 1){
      str += "\n";
    }
  }
  return str;
}

function Roulette_checkwin(injson, ball){//確認球號是否有中獎
  for(let i = 0; i < injson.length; i++){
    let win = false;
    for(let j = 0; j < injson[i].betstype.length; j++){
      if(injson[i].betstype[j] == ball){
        win = true;
        break;
      }
    }
    injson[i].win = win;
  }
}

function needmoney(injson){//查看所需金錢
  let money = 0;
  for(let i = 0; i < injson.length; i++){
    money += injson[i].bets;
  }
  return money;
}

function getmoney(injson){//查看獲得得金錢
  let money = 0;
  for(let i = 0; i < injson.length; i++){
    if(injson[i].win){
      money += injson[i].bets * ((36 / injson[i].betstype.length) - 1);
    }else{
      money -= injson[i].bets;
    }
  }
  return money;
}

function sort(sco) {//排序
  let temp;
  for (let i = 0; i < sco.length - 1; i++) {
    let Flag = false;
    for (let j = 0; j < sco.length - 1 - i; j++) {
      if (sco[j] > sco[j + 1]) {
        temp = sco[j];
        sco[j] = sco[j + 1];
        sco[j + 1] = temp;
        Flag = true;
      }
    }
    if (!Flag){
      break;
    }
  }
}

function rephelp(message){//幫助
  let str = '**幫助** 以下圖片為下注桌。\n可下注文字說明:\n可以直接以數字下注，或是使用快速下注編號。\n';
  str += '\n快速下注編號:\n上方英文(不限大小寫)可直接下注一直行(3個)，右邊三個則為下注一橫排\n';
  str += '下方的分別為三組12、前後半、奇數偶數、紅黑這幾種下注方式。\n';
  str += `以上下注都有不同用詞，可以輸入\"${keyword} 詞語表\"來確認詞語表\n`;
  str += '\n下注格式說明:\n開頭為\"輪盤\"空一格後開始下注，可以使用\"下注\"和空格分割各個注種\n';
  str += '然後使用\"賭注\"、\".\"、\"|\"分割下注方式和賭注，下注方式中的多個數字或字母以\",\"分割\n';
  str += '\n下注範例:\n輪盤 下注0賭注10 下注1,2,4,5賭注50 下注e,f賭注10 下注紅賭注20 下注ODD賭注30\n';
  str += '輪盤 0|10 1,2,4,5|50 e,F|10 紅|20 ODD|30\n輪盤 0.10 1,2,4,5.50 e,f.10 紅.20 ODD.30';
  message.reply(str + '\nhttps://raw.githubusercontent.com/maplelan/Discord-bot-Roulette/main/table.png');
}

function needhelp(message){//需要幫助
  message.reply(`你的下注有問題喔 可以輸入\"${keyword} help\"來取得幫助`);
}

function changetable(message){//顯示詞語列表
  let str = "以下為詞語列表 **皆不分大小寫**\n"
  + "__1to18:__  \"1~18\",\"1to18\",\"1-18\",\"1_18\",\"前半\"\n"
  + "__19to36:__  \"19~36\",\"19to36\",\"19-36\",\"19_36\",\"後半\"\n"
  + "__1st12:__  \"1~12\",\"1to12\",\"1_12\",\"1-12\",\"1of12\",\"1st12\"\n"
  + "__2nd12:__  \"13~24\",\"13to24\",\"13_24\",\"13-24\",\"2of12\",\"2nd12\",\"2_12\",\"2-12\"\n"
  + "__3rd12:__  \"25~36\",\"25to36\",\"25_36\",\"25-36\",\"3of12\",\"3rd12\",\"3_12\",\"3-12\"\n"
  + "__1col:__  \"1~34\",\"1_34\",\"1-34\",\"1to34\",\"1col\",\"1_c\",\"1_col\",\"1col\",\"1ofcol\"\n"
  + "__2col:__  \"2~35\",\"2_35\",\"2-35\",\"2to35\",\"2col\",\"2_c\",\"2_col\",\"2col\",\"2ofcol\"\n"
  + "__3col:__  \"3~36\",\"3_36\",\"3-36\",\"3to36\",\"3col\",\"3_c\",\"3_col\",\"3col\",\"3ofcol\"\n"
  + "__ODD:__  \"odd\",\"奇數\"\n"
  + "__EVEN:__  \"even\",\"偶數\"\n"
  + "__Black:__  \"black\",\"黑\",\"黑色\"\n"
  + "__Red:__  \"red\",\"紅\",\"紅色\"";
  message.reply(str);
}