const AWS = require("aws-sdk");
const dotenv = require('dotenv');

dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const ec2 = new AWS.EC2({
  region: 'us-east-1'
});

// const params = {
//   KeyName: 'random'
// }

// ec2.createKeyPair(params, function (err, data) {
//   if (err) {
//     console.log(err, err.stack)
//   } else {
//     console.log(data.KeyMaterial)
//   }
// })

ec2.runInstances({
  ImageId: 'ami-007855ac798b5175e',
  InstanceType: 't2.micro',
  KeyName: 'random',
  MaxCount: 1,
  MinCount: 1,
  NetworkInterfaces: [
    {
      DeviceIndex: 0,
      SubnetId: 'subnet-081abd700407550e4',
      AssociatePublicIpAddress: true
    }
  ]
}, function (err, data) {
  if (err) console.log(err, err.stack);
  else console.log(data.Instances[0].PublicIpAddress)
})






// ec2.deleteKeyPair(params, (err, data) => {
//   if (err) console.log(err, err.stack);
//   else console.log(data);
// })