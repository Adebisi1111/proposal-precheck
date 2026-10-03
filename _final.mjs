
const TX2='0x0a83cbfab5161ae0ed12eb771f62420246644b9877026def8e7e5e7f8212338d';
for (const host of ['explorer-studio-dev.genlayer.com','explorer-studio-next.genlayer.com']) {
  try {
    const r=await fetch(`https://${host}/api/transactions/${TX2}`);
    const j=await r.json();
    const lr=j?.transaction?.consensus_data?.leader_receipt;
    const e=Array.isArray(lr)?lr[0]:lr;
    console.log(host,'-> exec:',e?.execution_result,'| result:',e?.result?Buffer.from(e.result,'base64').toString().replace(/^\x00/,''):null);
  } catch(err){ console.log(host,'ERR'); }
}
