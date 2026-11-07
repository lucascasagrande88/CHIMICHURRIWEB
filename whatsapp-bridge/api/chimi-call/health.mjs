export default function health(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({service:'CHIMI CALL', transport:'twilio-media-streams',version:1});
}
