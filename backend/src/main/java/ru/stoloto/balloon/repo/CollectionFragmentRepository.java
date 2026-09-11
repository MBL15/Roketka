package ru.stoloto.balloon.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.stoloto.balloon.domain.CollectionFragment;

import java.util.List;

public interface CollectionFragmentRepository extends JpaRepository<CollectionFragment, Long> {

    List<CollectionFragment> findByUserIdAndCollectionLevel(Long userId, int collectionLevel);
}
