# ふよみ ピアノ版
ホームのAGENTS.mdを継承する。docs/decisions.mdが仕様。
外部実行依存・ビルド工程は追加しない。DOM操作はjs/app.jsに集める。
バイオリン版は変更しない。gitコマンドは使わず、公開はGitHub APIで行う。
検証はnode tests/run.mjs。譜面・判定・画面の実際の結果を確認する。
