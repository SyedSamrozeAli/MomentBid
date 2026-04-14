from django.conf import settings

from apps.blockchain.mock_service import MockBlockchainService
from apps.blockchain.service import BlockchainServiceBase
from apps.blockchain.web3_service import Web3BlockchainService


_mock_blockchain_service = MockBlockchainService()


def get_blockchain_service() -> BlockchainServiceBase:
    if settings.USE_MOCK_BLOCKCHAIN:
        return _mock_blockchain_service
    return Web3BlockchainService()
